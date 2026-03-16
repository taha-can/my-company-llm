"""Tool that lets a lead agent consult a team member (worker agent) internally."""

from __future__ import annotations

import json

from backend.tools.base import Tool, ToolRegistry


class ConsultTeamMemberTool(Tool):
    name = "consult_team_member"
    description = (
        "As a team lead, consult one of your team members (worker agents) by asking them a question. "
        "The worker will process your question and return their response. "
        "Use this when you need specialized input from a team member to answer the CEO's request."
    )
    parameters = {
        "agent_id": {
            "type": "string",
            "description": "The ID of the team member (worker agent) to consult",
        },
        "question": {
            "type": "string",
            "description": "The question or task to ask the team member",
        },
    }

    def __init__(self):
        self._team_members: list[dict] = []

    def set_team_members(self, members: list[dict]):
        self._team_members = members

    async def execute(self, agent_id: str, question: str, **kwargs) -> str:
        from backend.db.database import async_session
        from backend.db.models import AgentRecord
        from backend.engine.runner import run_agent_simple
        from backend.models.agent import AgentDefinition

        async with async_session() as session:
            agent_rec = await session.get(AgentRecord, agent_id)
            if not agent_rec:
                return json.dumps({"error": f"Team member {agent_id} not found"})

            agent_def = AgentDefinition(
                id=agent_rec.id,
                name=agent_rec.name,
                role=agent_rec.role,
                goal=agent_rec.goal,
                system_prompt=agent_rec.system_prompt,
                agent_type=agent_rec.agent_type,
                llm_model=agent_rec.llm_model,
                tools=json.loads(agent_rec.tools) if agent_rec.tools else [],
                parent_agent_id=agent_rec.parent_agent_id,
                department=agent_rec.department,
                status=agent_rec.status,
                email=agent_rec.email,
                avatar_url=agent_rec.avatar_url,
                workspace_provisioned=agent_rec.workspace_provisioned or "none",
                slack_member_id=agent_rec.slack_member_id,
                created_at=agent_rec.created_at,
                updated_at=agent_rec.updated_at,
            )

        response = await run_agent_simple(agent_def, question)

        return json.dumps({
            "team_member": agent_rec.name,
            "role": agent_rec.role,
            "response": response,
        })


ToolRegistry.register(ConsultTeamMemberTool())
