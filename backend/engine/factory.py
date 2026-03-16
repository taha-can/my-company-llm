from __future__ import annotations

import json

from litellm import acompletion

from backend.config import settings
from backend.models.agent import AgentCreate, AgentDefinition, AgentType
from backend.tools.base import ToolRegistry


AGENT_GENERATOR_PROMPT = """\
You are an AI workforce architect. Given a natural language description of a desired AI agent, \
generate a structured agent definition.

Available tools that can be assigned to agents:
{available_tools}

Available models and their best use cases:
- gpt-4o: Best for leadership roles, complex reasoning, multi-step tasks, data analysis
- gpt-4o-mini: Fast and cheap, good for routine tasks, routing, simple responses
- anthropic/claude-sonnet-4-20250514: Excellent for creative writing, marketing copy, long-form content, nuanced analysis
- anthropic/claude-haiku-3.5-20241022: Ultra-fast, high-volume tasks, simple classification
- dall-e-3: Image generation (assign to agents with generate_image tool)

When the agent needs creative/marketing capabilities, prefer Claude Sonnet for text and assign \
generate_image, generate_video, or generate_marketing_content tools as appropriate.

Respond with a JSON object matching this schema (no markdown, just raw JSON):
{{
  "name": "string - concise agent name",
  "role": "string - one-line role description",
  "goal": "string - what this agent aims to achieve",
  "system_prompt": "string - detailed system prompt for the agent",
  "agent_type": "lead | worker",
  "llm_model": "string - model to use based on the role requirements",
  "tools": ["list", "of", "tool", "names"],
  "department": "string - department name (e.g. marketing, sales, engineering, design)",
  "parent_agent_id": null
}}
"""


async def generate_agent_definition(description: str) -> AgentCreate:
    """Use LLM to generate an agent definition from natural language."""

    available = ToolRegistry.all_names()
    tool_details = []
    for name in available:
        tool = ToolRegistry.get(name)
        if tool:
            tool_details.append(f"- {name}: {tool.description}")

    prompt = AGENT_GENERATOR_PROMPT.format(
        available_tools="\n".join(tool_details) if tool_details else "None registered yet"
    )

    response = await acompletion(
        model=settings.default_router_model,
        messages=[
            {"role": "system", "content": prompt},
            {"role": "user", "content": description},
        ],
        response_format={"type": "json_object"},
        api_key=settings.openai_api_key or None,
    )

    raw = response.choices[0].message.content
    data = json.loads(raw)

    return AgentCreate(
        name=data["name"],
        role=data["role"],
        goal=data["goal"],
        system_prompt=data["system_prompt"],
        agent_type=AgentType(data.get("agent_type", "worker")),
        llm_model=data.get("llm_model", settings.default_worker_model),
        tools=data.get("tools", []),
        department=data.get("department", "general"),
        parent_agent_id=data.get("parent_agent_id"),
    )
