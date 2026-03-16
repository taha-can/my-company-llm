from __future__ import annotations

import json

from litellm import acompletion
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from backend.config import settings
from backend.db.models import AgentRecord
from backend.tools.base import merge_with_default_tools


ROUTER_PROMPT = """\
You are a CEO's executive assistant. Given a message from the CEO, determine which department \
should handle it.

Available departments and their agents:
{departments}

When routing, consider:
1. Match the intent of the message to the most relevant department
2. Each department has a lead agent and may have worker agents with specialized roles
3. If the question is department-specific, route to that department's lead
4. If multiple departments could handle it, choose the most relevant one

Respond with JSON:
{{
  "department": "string - the department name",
  "agent_id": "string - the lead agent's ID",
  "reasoning": "string - brief explanation"
}}

If no department matches, respond with:
{{
  "department": "none",
  "agent_id": null,
  "reasoning": "explanation of why no department matches"
}}
"""


async def route_message(message: str, session: AsyncSession) -> dict:
    """Route a CEO message to the appropriate department lead."""

    result = await session.execute(select(AgentRecord))
    all_agents = result.scalars().all()

    leads = [a for a in all_agents if a.agent_type == "lead"]
    if not leads:
        return {
            "department": "none",
            "agent_id": None,
            "reasoning": "No department leads configured.",
        }

    # Group agents by department for richer routing context
    dept_agents: dict[str, list] = {}
    for agent in all_agents:
        dept_agents.setdefault(agent.department, []).append(agent)

    dept_info = []
    for lead in leads:
        tools = merge_with_default_tools(json.loads(lead.tools) if lead.tools else [])
        workers = [a for a in dept_agents.get(lead.department, []) if a.agent_type == "worker"]
        worker_desc = ""
        if workers:
            worker_names = [f"{w.name} ({w.role})" for w in workers]
            worker_desc = f" | Workers: {', '.join(worker_names)}"
        dept_info.append(
            f"- Department: {lead.department} | Lead: {lead.name} (ID: {lead.id}) | "
            f"Role: {lead.role} | Tools: {', '.join(tools)}{worker_desc}"
        )

    prompt = ROUTER_PROMPT.format(departments="\n".join(dept_info))

    response = await acompletion(
        model=settings.default_router_model,
        messages=[
            {"role": "system", "content": prompt},
            {"role": "user", "content": message},
        ],
        response_format={"type": "json_object"},
        api_key=settings.openai_api_key or None,
    )

    raw = response.choices[0].message.content
    return json.loads(raw)
