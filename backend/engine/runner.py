from __future__ import annotations

import json
from typing import Any, AsyncGenerator

from litellm import acompletion

from sqlalchemy import select

from backend.engine.memory import AgentMemory, SharedKnowledgeBase, DepartmentKnowledgeBase
from backend.engine.mcp_bridge import (
    call_mcp_tool,
    mcp_tools_to_openai_functions,
    parse_mcp_tool_name,
)
from backend.models.agent import AgentDefinition
from backend.models.model_registry import get_model_info
from backend.models.task import Board
from backend.tools.base import ToolRegistry, merge_with_default_tools
from backend.config import settings

# Ensure tools are registered
import backend.tools.rag  # noqa: F401
import backend.tools.twitter  # noqa: F401
import backend.tools.linkedin  # noqa: F401
import backend.tools.instagram  # noqa: F401
import backend.tools.gmail  # noqa: F401
import backend.tools.calendar  # noqa: F401
import backend.tools.drive  # noqa: F401
import backend.tools.image_gen  # noqa: F401
import backend.tools.video_gen  # noqa: F401
import backend.tools.marketing  # noqa: F401
import backend.tools.team  # noqa: F401
import backend.tools.tasks  # noqa: F401


def _estimate_tokens(text: str) -> int:
    """Rough token estimate: ~4 chars per token for English text."""
    return max(1, len(text) // 4)


def _messages_token_count(messages: list[dict]) -> int:
    total = 0
    for msg in messages:
        content = msg.get("content", "")
        if isinstance(content, str):
            total += _estimate_tokens(content)
        total += 4  # per-message overhead
    return total


def _get_context_window(model_id: str) -> int:
    info = get_model_info(model_id)
    if info:
        return info.context_window
    if "gpt-4o" in model_id:
        return 128_000
    if "claude" in model_id:
        return 200_000
    return 128_000


def _maybe_parse_json(value: str) -> dict[str, Any] | None:
    try:
        parsed = json.loads(value)
    except (TypeError, json.JSONDecodeError):
        return None
    return parsed if isinstance(parsed, dict) else None


async def run_agent(
    agent: AgentDefinition,
    user_message: str,
    chat_history: list[dict[str, str]] | None = None,
    department_context: str | None = None,
    team_members: list[dict[str, str]] | None = None,
    max_iterations: int = 10,
) -> AsyncGenerator[dict[str, Any], None]:
    """Run an agent with tool-use loop, yielding streaming events.

    Args:
        team_members: list of dicts with id/name/role/tools for worker agents
                      under this lead.  When provided the ``consult_team_member``
                      tool is automatically made available.
    """

    memory = AgentMemory(agent.id)

    # Bind agent-specific memory and department to RAG tool
    rag_tool = ToolRegistry.get("search_knowledge")
    if rag_tool and hasattr(rag_tool, "set_agent_memory"):
        rag_tool.set_agent_memory(memory)
    if rag_tool and hasattr(rag_tool, "set_department") and agent.department:
        rag_tool.set_department(agent.department)

    # Bind team members to the consult tool
    if team_members:
        consult_tool = ToolRegistry.get("consult_team_member")
        if consult_tool and hasattr(consult_tool, "set_team_members"):
            consult_tool.set_team_members(team_members)

    # ── Knowledge Hierarchy ──
    # 1. Company knowledge (highest priority)
    company_kb = SharedKnowledgeBase()
    company_results = company_kb.search(user_message, top_k=3)

    # 2. Department knowledge
    dept_results = []
    if agent.department:
        dept_kb = DepartmentKnowledgeBase(agent.department)
        dept_results = dept_kb.search(user_message, top_k=3)

    # 3. Agent's own memory (episodic + semantic)
    past_experiences = memory.search_episodic(user_message, top_k=3)
    past_knowledge = memory.search_semantic(user_message, top_k=3)

    context_parts = []
    context_sources: dict[str, int] = {}

    identity_lines = [
        "## Your Identity:",
        f"- Name: {agent.name}",
        f"- Role: {agent.role}",
        f"- Department: {agent.department}",
        f"- Work email: {agent.email or 'Not configured'}",
    ]
    if agent.workspace_provisioned and agent.workspace_provisioned != "none":
        identity_lines.append(f"- Workspace provider: {agent.workspace_provisioned}")
    if agent.slack_member_id:
        identity_lines.append(f"- Slack member ID: {agent.slack_member_id}")
    identity_lines.extend([
        "- If asked to introduce yourself or share your contact details, you may share the identity fields listed above.",
        "- Never invent missing contact information. If a work email is not configured, say so plainly.",
    ])
    context_parts.append("\n".join(identity_lines))
    context_sources["agent_identity"] = 1

    if company_results:
        context_parts.append("## Company Knowledge (highest priority):\n" + "\n".join(
            f"- {r['text']}" for r in company_results
        ))
        context_sources["company_knowledge"] = len(company_results)

    if dept_results:
        context_parts.append(f"## {agent.department} Department Knowledge:\n" + "\n".join(
            f"- {r['text']}" for r in dept_results
        ))
        context_sources["department_knowledge"] = len(dept_results)

    if past_experiences:
        context_parts.append("## Relevant past experiences:\n" + "\n".join(
            f"- {r['text']}" for r in past_experiences
        ))
        context_sources["agent_memory"] = len(past_experiences)

    if past_knowledge:
        context_parts.append("## Relevant knowledge:\n" + "\n".join(
            f"- {r['text']}" for r in past_knowledge
        ))
        context_sources["agent_knowledge"] = len(past_knowledge)

    if department_context:
        context_parts.append(f"## Department Context:\n{department_context}")
        context_sources["department_context"] = 1

    # Inject team member info so the lead knows their team
    if team_members:
        team_text = "\n".join(
            f"- **{m['name']}** (ID: `{m['id']}`) — Role: {m['role']}"
            + (f" — Department: {m['department']}" if m.get("department") else "")
            + (f" — Work email: {m['email']}" if m.get("email") else "")
            + (f" — Tools: {m['tools']}" if m.get("tools") else "")
            for m in team_members
        )
        context_parts.append(
            f"## Your Team Members ({len(team_members)} worker(s)):\n"
            f"You are the team lead. These are your workers. "
            f"Use the `consult_team_member` tool to ask them questions when you need their expertise.\n"
            f"{team_text}"
        )
        context_sources["team_members"] = len(team_members)

    memory_context = "\n\n".join(context_parts) if context_parts else ""

    # Make task creation available across the chat experience so agents can
    # create PM-board items directly from user requests.
    agent_tool_names = merge_with_default_tools(agent.tools)

    system_prompt = agent.system_prompt
    system_prompt += (
        "\n\n## Contact Sharing Rules\n"
        "- You may share your own work email, role, and department when they are present in your context.\n"
        "- You may share coworkers' work emails only when those emails are explicitly listed in your provided context.\n"
        "- Do not refuse to share internal work emails that are already provided to you in context.\n"
        "- Never invent contact details. If information is missing, say it is not configured or not available."
    )
    if "create_project_task" in agent_tool_names:
        system_prompt += (
            "\n\n## Project Task Rules\n"
            "- When the user asks to create, add, log, or track a task in the project management app, use the `create_project_task` tool.\n"
            "- After the tool succeeds, briefly confirm what task was created and who it was assigned to, if anyone.\n"
            "- Do not pretend a task was created unless the tool actually succeeds."
        )
    if "send_email" in agent_tool_names:
        system_prompt += (
            "\n\n## Email Rules\n"
            "- When the user asks you to send or email someone, use the `send_email` tool instead of only drafting a message.\n"
            "- Gather any missing required fields before sending: recipient, subject, and body.\n"
            "- Do not claim an email was sent unless the `send_email` tool returns success.\n"
            "- After sending, briefly confirm the recipient and subject."
        )
    if memory_context:
        system_prompt += f"\n\n---\n{memory_context}"

    messages = [
        {"role": "system", "content": system_prompt},
    ]

    if chat_history:
        messages.extend(chat_history)
        context_sources["chat_history"] = len(chat_history)

    messages.append({"role": "user", "content": user_message})
    memory.add_to_working("user", user_message)

    # Build tool list — auto-add consult_team_member for leads with team
    if team_members and "consult_team_member" not in agent_tool_names:
        agent_tool_names.append("consult_team_member")

    tools = ToolRegistry.as_openai_functions(agent_tool_names) if agent_tool_names else None

    # Load enabled MCP servers and append their tools
    mcp_server_map: dict[str, Any] = {}
    mcp_connected = False
    try:
        from backend.db.database import async_session
        from backend.db.models import McpServerRecord

        async with async_session() as db:
            result = await db.execute(
                select(McpServerRecord).where(McpServerRecord.enabled == "true")
            )
            for srv in result.scalars().all():
                srv_key = srv.name.lower().replace(" ", "_")
                mcp_server_map[srv_key] = srv
                mcp_fns = mcp_tools_to_openai_functions(srv)
                if mcp_fns:
                    mcp_connected = True
                    if tools is None:
                        tools = []
                    tools.extend(mcp_fns)
    except Exception:
        pass

    if mcp_connected:
        context_sources["mcp_tools"] = len(mcp_server_map)

    context_sources["llm_knowledge"] = 1

    # Calculate context usage percentage
    context_window = _get_context_window(agent.llm_model)
    tokens_used = _messages_token_count(messages)
    if tools:
        tokens_used += _estimate_tokens(json.dumps(tools))
    context_percentage = min(100.0, round((tokens_used / context_window) * 100, 1))

    yield {
        "type": "agent_start",
        "agent_id": agent.id,
        "agent_name": agent.name,
    }

    yield {
        "type": "context_info",
        "agent_id": agent.id,
        "agent_name": agent.name,
        "context_percentage": context_percentage,
        "tokens_used": tokens_used,
        "context_window": context_window,
        "sources": context_sources,
    }

    for iteration in range(max_iterations):
        call_kwargs: dict[str, Any] = {
            "model": agent.llm_model,
            "messages": messages,
        }
        if tools:
            call_kwargs["tools"] = tools
            call_kwargs["tool_choice"] = "auto"

        if agent.llm_model.startswith("anthropic/"):
            call_kwargs["api_key"] = settings.anthropic_api_key or None
        else:
            call_kwargs["api_key"] = settings.openai_api_key or None

        response = await acompletion(**call_kwargs)
        choice = response.choices[0]
        msg = choice.message

        if msg.tool_calls:
            messages.append(msg.model_dump())

            for tool_call in msg.tool_calls:
                fn_name = tool_call.function.name
                fn_args = json.loads(tool_call.function.arguments)

                yield {
                    "type": "tool_call",
                    "agent_id": agent.id,
                    "agent_name": agent.name,
                    "tool": fn_name,
                    "arguments": fn_args,
                }

                mcp_parsed = parse_mcp_tool_name(fn_name)
                if mcp_parsed:
                    srv_key, mcp_tool_name = mcp_parsed
                    srv = mcp_server_map.get(srv_key)
                    if srv:
                        result = await call_mcp_tool(srv, mcp_tool_name, fn_args)
                    else:
                        result = json.dumps({"error": f"MCP server not found: {srv_key}"})
                else:
                    tool = ToolRegistry.get(fn_name)
                    if tool:
                        result = await tool.execute(**fn_args, _agent_id=agent.id)
                    else:
                        result = json.dumps({"error": f"Unknown tool: {fn_name}"})

                yield {
                    "type": "tool_result",
                    "agent_id": agent.id,
                    "agent_name": agent.name,
                    "tool": fn_name,
                    "result": result,
                }

                if fn_name == "create_project_task":
                    task_payload = _maybe_parse_json(result)
                    if task_payload and task_payload.get("ok") and task_payload.get("task_id"):
                        yield {
                            "type": "task_created",
                            "task_id": task_payload.get("task_id"),
                            "agent_id": task_payload.get("agent_id"),
                            "agent_name": task_payload.get("agent_name", "Unassigned"),
                            "directive": task_payload.get("directive", ""),
                            "status": task_payload.get("status", "pending"),
                            "board": task_payload.get("board", Board.BACKLOG),
                        }

                messages.append({
                    "role": "tool",
                    "tool_call_id": tool_call.id,
                    "content": result,
                })
        else:
            content = msg.content or ""
            memory.add_to_working("assistant", content)

            yield {
                "type": "agent_message",
                "agent_id": agent.id,
                "agent_name": agent.name,
                "content": content,
            }

            # Save episodic memory after task completes
            task_summary = (
                f"Task: {user_message}\n"
                f"Result: {content[:500]}"
            )
            memory.store_episodic(task_summary, metadata={"task": user_message})

            yield {
                "type": "agent_done",
                "agent_id": agent.id,
                "agent_name": agent.name,
            }
            return

    yield {
        "type": "agent_error",
        "agent_id": agent.id,
        "agent_name": agent.name,
        "error": "Max iterations reached",
    }


async def run_agent_simple(agent: AgentDefinition, user_message: str) -> str:
    """Run an agent and return the final text response (non-streaming)."""
    final_content = ""
    async for event in run_agent(agent, user_message):
        if event["type"] == "agent_message":
            final_content = event["content"]
        elif event["type"] == "agent_error":
            final_content = f"Error: {event['error']}"
    return final_content
