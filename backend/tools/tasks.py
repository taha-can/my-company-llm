"""Task management tools that let agents create project tasks."""

from __future__ import annotations

import json

from sqlalchemy import select

from backend.db.database import async_session
from backend.db.models import AgentRecord, TaskRecord
from backend.models.task import Board
from backend.tools.base import Tool, ToolRegistry


class CreateProjectTaskTool(Tool):
    name = "create_project_task"
    description = (
        "Create a task in the project management board. "
        "Use this when the user asks you to create, add, log, or track a task."
    )
    parameters = {
        "directive": {
            "type": "string",
            "description": "Short task title or directive to add to the project board.",
        },
        "description": {
            "type": "string",
            "description": "Optional extra implementation details or notes for the task.",
        },
        "board": {
            "type": "string",
            "description": "Target board name such as backlog, in_progress, or done.",
        },
        "priority": {
            "type": "string",
            "description": "Task priority: low, medium, high, or urgent.",
        },
        "assignee_name": {
            "type": "string",
            "description": (
                "Optional assignee name. Use an exact teammate name when the user specifies one. "
                "Leave omitted when the task should stay unassigned."
            ),
        },
    }
    required = ["directive"]

    async def execute(
        self,
        directive: str,
        description: str = "",
        board: str = Board.BACKLOG,
        priority: str = "medium",
        assignee_name: str = "",
        **kwargs,
    ) -> str:
        clean_directive = directive.strip()
        if not clean_directive:
            return json.dumps({"ok": False, "error": "Task directive is required"})

        clean_board = (board or Board.BACKLOG).strip().lower().replace(" ", "_")
        clean_priority = (priority or "medium").strip().lower()
        clean_assignee = assignee_name.strip()

        agent_id = None
        agent_name = "Unassigned"

        async with async_session() as session:
            if clean_assignee:
                exact_match = await session.execute(
                    select(AgentRecord).where(AgentRecord.name.ilike(clean_assignee))
                )
                assignee = exact_match.scalars().first()

                if not assignee:
                    fuzzy_match = await session.execute(
                        select(AgentRecord).where(AgentRecord.name.ilike(f"%{clean_assignee}%"))
                    )
                    assignee = fuzzy_match.scalars().first()

                if not assignee:
                    return json.dumps(
                        {
                            "ok": False,
                            "error": f"Could not find an agent named '{clean_assignee}'",
                        }
                    )

                agent_id = assignee.id
                agent_name = assignee.name

            task_rec = TaskRecord(
                agent_id=agent_id,
                directive=clean_directive,
                description=description.strip(),
                status="pending",
                board=clean_board,
                priority=clean_priority,
            )
            session.add(task_rec)
            await session.commit()
            await session.refresh(task_rec)

        return json.dumps(
            {
                "ok": True,
                "task_id": task_rec.id,
                "directive": task_rec.directive,
                "description": task_rec.description or "",
                "board": task_rec.board,
                "priority": task_rec.priority,
                "status": task_rec.status,
                "agent_id": agent_id,
                "agent_name": agent_name,
            }
        )


ToolRegistry.register(CreateProjectTaskTool())
