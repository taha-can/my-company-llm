from __future__ import annotations

import json
from datetime import datetime

from fastapi import APIRouter, Depends, Query, WebSocket, WebSocketDisconnect
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from backend.config import settings
from backend.db.database import async_session, get_session
from backend.db.models import AgentRecord, ChatSessionRecord, MessageRecord, TaskRecord
from backend.engine.router import route_message
from backend.engine.runner import run_agent
from backend.models.agent import AgentDefinition
from backend.models.task import Board
from backend.tools.base import merge_with_default_tools

router = APIRouter()


@router.post("/sessions")
async def create_session(
    body: dict | None = None,
    session: AsyncSession = Depends(get_session),
):
    """Create a new chat session."""
    title = (body or {}).get("title", "New Chat")
    rec = ChatSessionRecord(title=title)
    session.add(rec)
    await session.commit()
    await session.refresh(rec)
    return {
        "id": rec.id,
        "title": rec.title,
        "created_at": rec.created_at.isoformat() if rec.created_at else None,
        "message_count": 0,
    }


@router.get("/sessions")
async def list_sessions(
    limit: int = Query(30, ge=1, le=100),
    session: AsyncSession = Depends(get_session),
):
    """List chat sessions, newest first."""
    from sqlalchemy import func

    stmt = (
        select(
            ChatSessionRecord,
            func.count(MessageRecord.id).label("msg_count"),
        )
        .outerjoin(MessageRecord, MessageRecord.session_id == ChatSessionRecord.id)
        .group_by(ChatSessionRecord.id)
        .order_by(ChatSessionRecord.created_at.desc())
        .limit(limit)
    )
    result = await session.execute(stmt)
    rows = result.all()

    return [
        {
            "id": row[0].id,
            "title": row[0].title,
            "created_at": row[0].created_at.isoformat() if row[0].created_at else None,
            "updated_at": row[0].updated_at.isoformat() if row[0].updated_at else None,
            "message_count": row[1],
        }
        for row in rows
    ]


@router.get("/sessions/{session_id}/messages")
async def get_session_messages(
    session_id: str,
    session: AsyncSession = Depends(get_session),
):
    """Get all messages in a chat session as ChatEvent-shaped objects."""
    sess_rec = await session.get(ChatSessionRecord, session_id)
    if not sess_rec:
        from fastapi import HTTPException
        raise HTTPException(404, "Session not found")

    result = await session.execute(
        select(MessageRecord)
        .where(MessageRecord.session_id == session_id)
        .order_by(MessageRecord.created_at.asc())
    )
    records = result.scalars().all()

    agent_names: dict[str, str] = {}
    events = []
    for msg in records:
        if msg.role == "ceo":
            events.append({
                "type": "ceo_message",
                "content": msg.content,
                "agent_name": "You",
                "created_at": msg.created_at.isoformat() if msg.created_at else None,
            })
        elif msg.role == "ceo_office":
            events.append({
                "type": "agent_message",
                "content": msg.content,
                "agent_name": "CEO Office",
                "created_at": msg.created_at.isoformat() if msg.created_at else None,
            })
        else:
            if msg.agent_id and msg.agent_id not in agent_names:
                agent_rec = await session.get(AgentRecord, msg.agent_id)
                agent_names[msg.agent_id] = agent_rec.name if agent_rec else "Agent"
            agent_name = agent_names.get(msg.agent_id or "", "Agent")
            events.append({
                "type": "agent_message",
                "content": msg.content,
                "agent_id": msg.agent_id,
                "agent_name": agent_name,
                "created_at": msg.created_at.isoformat() if msg.created_at else None,
            })

    return {"session": {"id": sess_rec.id, "title": sess_rec.title}, "events": events}


@router.delete("/sessions/{session_id}")
async def delete_session(
    session_id: str,
    session: AsyncSession = Depends(get_session),
):
    """Delete a chat session and its messages."""
    sess_rec = await session.get(ChatSessionRecord, session_id)
    if not sess_rec:
        from fastapi import HTTPException
        raise HTTPException(404, "Session not found")

    await session.execute(
        select(MessageRecord).where(MessageRecord.session_id == session_id)
    )
    from sqlalchemy import delete as sql_delete
    await session.execute(
        sql_delete(MessageRecord).where(MessageRecord.session_id == session_id)
    )
    await session.delete(sess_rec)
    await session.commit()
    return {"deleted": True}


def _record_to_definition(rec: AgentRecord) -> AgentDefinition:
    return AgentDefinition(
        id=rec.id,
        name=rec.name,
        role=rec.role,
        goal=rec.goal,
        system_prompt=rec.system_prompt,
        agent_type=rec.agent_type,
        llm_model=rec.llm_model,
        tools=merge_with_default_tools(json.loads(rec.tools) if rec.tools else []),
        parent_agent_id=rec.parent_agent_id,
        department=rec.department,
        status=rec.status,
        email=rec.email,
        avatar_url=rec.avatar_url,
        workspace_provisioned=rec.workspace_provisioned or "none",
        slack_member_id=rec.slack_member_id,
        created_at=rec.created_at,
        updated_at=rec.updated_at,
    )


def _build_team_members(records: list[AgentRecord]) -> list[dict[str, str]]:
    return [
        {
            "id": record.id,
            "name": record.name,
            "role": record.role,
            "department": record.department,
            "email": record.email or "",
            "tools": record.tools or "[]",
        }
        for record in records
    ]


def _build_agent_directory(records: list[AgentRecord]) -> str:
    lines = [
        (
            f"- {record.name} — {record.role} — Department: {record.department} — "
            f"Work email: {record.email or 'Not configured'}"
        )
        for record in records
    ]
    if not lines:
        return ""
    return (
        "## Company Directory:\n"
        "Use this directory when the user asks who works here or asks for work contact details. "
        "Only share the work emails listed here and never invent missing contact information.\n"
        + "\n".join(lines)
    )


def _build_ceo_office_assistant() -> AgentDefinition:
    return AgentDefinition(
        id="ceo-office-direct",
        name="CEO Office",
        role="Executive Assistant",
        goal="Respond directly when no department or agent is available.",
        system_prompt=(
            "You are the CEO Office assistant for my-company-llm. "
            "When a request cannot be routed to a department or agent, respond directly and clearly. "
            "Acknowledge that the request was escalated to CEO Office, explain any missing department context, "
            "and provide the best direct answer you can without inventing organizational structure. "
            "If a company directory is provided in your context, you may share those listed work emails."
        ),
        agent_type="lead",
        llm_model=settings.default_lead_model,
        tools=merge_with_default_tools([]),
        department="ceo_office",
        status="idle",
    )


async def _chat_with_definition(
    ws: WebSocket,
    session,
    agent_def: AgentDefinition,
    user_message: str,
    chat_session_id: str | None = None,
    department_context: str | None = None,
    team_members: list[dict[str, str]] | None = None,
    persist_agent_id: str | None = None,
    persist_role: str = "agent",
) -> str | None:
    """Chat with a concrete or synthetic agent definition and stream results."""
    if chat_session_id:
        history_result = await session.execute(
            select(MessageRecord)
            .where(MessageRecord.session_id == chat_session_id)
            .order_by(MessageRecord.created_at.desc())
            .limit(20)
        )
        recent_messages = list(history_result.scalars().all())
    elif persist_agent_id:
        history_result = await session.execute(
            select(MessageRecord)
            .where(MessageRecord.agent_id == persist_agent_id)
            .order_by(MessageRecord.created_at.desc())
            .limit(10)
        )
        recent_messages = list(history_result.scalars().all())
    else:
        recent_messages = []
    recent_messages.reverse()

    chat_history = []
    for msg in recent_messages:
        role = "user" if msg.role == "ceo" else "assistant"
        chat_history.append({"role": role, "content": msg.content})

    if persist_agent_id:
        session.add(MessageRecord(
            role="ceo",
            agent_id=persist_agent_id,
            session_id=chat_session_id,
            content=user_message,
        ))
        await session.commit()

    if chat_session_id:
        sess_rec = await session.get(ChatSessionRecord, chat_session_id)
        if sess_rec:
            sess_rec.updated_at = datetime.utcnow()
            if sess_rec.title == "New Chat":
                sess_rec.title = user_message[:60] + ("..." if len(user_message) > 60 else "")

    final_response = None
    async for event in run_agent(
        agent_def,
        user_message,
        chat_history=chat_history,
        department_context=department_context,
        team_members=team_members,
    ):
        await ws.send_json(event)

        if event["type"] == "agent_message":
            final_response = event["content"]
            session.add(MessageRecord(
                role=persist_role,
                agent_id=persist_agent_id,
                session_id=chat_session_id,
                content=event["content"],
            ))

    await session.commit()
    return final_response


async def _chat_with_agent(
    ws: WebSocket,
    session,
    agent_id: str,
    user_message: str,
    chat_session_id: str | None = None,
    department_context: str | None = None,
    team_members: list[dict[str, str]] | None = None,
) -> str | None:
    """Chat with an agent and stream results over the WebSocket.
    Returns the agent's final response text."""
    agent_rec = await session.get(AgentRecord, agent_id)
    if not agent_rec:
        return None

    agent_def = _record_to_definition(agent_rec)
    return await _chat_with_definition(
        ws=ws,
        session=session,
        agent_def=agent_def,
        user_message=user_message,
        chat_session_id=chat_session_id,
        department_context=department_context,
        team_members=team_members,
        persist_agent_id=agent_id,
        persist_role="agent",
    )


async def _fallback_to_ceo_office(
    ws: WebSocket,
    session,
    user_message: str,
    chat_session_id: str | None,
    reason: str,
):
    directory_result = await session.execute(
        select(AgentRecord).order_by(AgentRecord.department.asc(), AgentRecord.name.asc())
    )
    directory_context = _build_agent_directory(list(directory_result.scalars().all()))
    await ws.send_json({
        "type": "routing",
        "department": "CEO Office",
        "reasoning": reason,
    })
    return await _chat_with_definition(
        ws=ws,
        session=session,
        agent_def=_build_ceo_office_assistant(),
        user_message=user_message,
        chat_session_id=chat_session_id,
        department_context=directory_context or None,
        persist_role="ceo_office",
    )


@router.websocket("/chat")
async def chat_websocket(ws: WebSocket):
    await ws.accept()

    try:
        while True:
            data = await ws.receive_text()
            payload = json.loads(data)
            action = payload.get("action", "message")

            async with async_session() as session:

                if action == "message":
                    user_message = payload.get("content", "")
                    target_agent_id = payload.get("agent_id")
                    target_department = payload.get("department")
                    chat_session_id = payload.get("session_id")

                    if not user_message:
                        await ws.send_json({"type": "error", "error": "Empty message"})
                        continue

                    ceo_msg = MessageRecord(role="ceo", content=user_message, session_id=chat_session_id)
                    session.add(ceo_msg)
                    await session.commit()

                    if target_agent_id:
                        agent_rec = await session.get(AgentRecord, target_agent_id)
                        if agent_rec:
                            await ws.send_json({
                                "type": "routing",
                                "department": "direct",
                                "reasoning": "Direct message to agent",
                            })
                            await _chat_with_agent(ws, session, target_agent_id, user_message, chat_session_id)
                        else:
                            await _fallback_to_ceo_office(
                                ws,
                                session,
                                user_message,
                                chat_session_id,
                                "The selected agent could not be found. Escalated to CEO Office for a direct response.",
                            )

                    elif target_department and target_department != "auto":
                        # Find the lead agent for this department
                        result = await session.execute(
                            select(AgentRecord).where(
                                AgentRecord.department == target_department,
                                AgentRecord.agent_type == "lead",
                            )
                        )
                        lead = result.scalars().first()

                        if not lead:
                            # Fallback: any agent in the department
                            result = await session.execute(
                                select(AgentRecord).where(
                                    AgentRecord.department == target_department,
                                )
                            )
                            lead = result.scalars().first()

                        if not lead:
                            await _fallback_to_ceo_office(
                                ws,
                                session,
                                user_message,
                                chat_session_id,
                                f"No agents are assigned to the '{target_department}' department. Escalated to CEO Office for a direct answer.",
                            )
                            continue

                        # Gather worker agents as team members
                        workers_result = await session.execute(
                            select(AgentRecord).where(
                                AgentRecord.department == target_department,
                                AgentRecord.id != lead.id,
                            )
                        )
                        workers = list(workers_result.scalars().all())
                        team_members = _build_team_members(workers)

                        team_desc = f"Lead: {lead.name}"
                        if workers:
                            team_desc += f" + {len(workers)} team member(s)"

                        await ws.send_json({
                            "type": "routing",
                            "department": target_department,
                            "reasoning": team_desc,
                        })

                        await _chat_with_agent(
                            ws,
                            session,
                            lead.id,
                            user_message,
                            chat_session_id,
                            team_members=team_members if team_members else None,
                        )

                    else:
                        route_result = await route_message(user_message, session)
                        agent_id = route_result.get("agent_id")
                        if not agent_id:
                            await _fallback_to_ceo_office(
                                ws,
                                session,
                                user_message,
                                chat_session_id,
                                f"Auto-routing could not match a department. {route_result.get('reasoning', '')}".strip(),
                            )
                            continue

                        # If the routed agent is a lead, give them their team
                        routed_agent = await session.get(AgentRecord, agent_id)
                        if not routed_agent:
                            await _fallback_to_ceo_office(
                                ws,
                                session,
                                user_message,
                                chat_session_id,
                                "The routed department agent is no longer available. Escalated to CEO Office for a direct response.",
                            )
                            continue

                        await ws.send_json({
                            "type": "routing",
                            "department": route_result.get("department"),
                            "reasoning": route_result.get("reasoning"),
                        })
                        team_members = None
                        if routed_agent.agent_type == "lead":
                            workers_result = await session.execute(
                                select(AgentRecord).where(
                                    AgentRecord.department == routed_agent.department,
                                    AgentRecord.id != routed_agent.id,
                                )
                            )
                            workers = list(workers_result.scalars().all())
                            if workers:
                                team_members = _build_team_members(workers)

                        await _chat_with_agent(
                            ws, session, agent_id, user_message, chat_session_id,
                            team_members=team_members,
                        )

                elif action == "add_task":
                    agent_id = payload.get("agent_id")
                    directive = payload.get("directive", "")
                    if not agent_id or not directive:
                        await ws.send_json({"type": "error", "error": "agent_id and directive required"})
                        continue

                    agent_rec = await session.get(AgentRecord, agent_id)
                    if not agent_rec:
                        await ws.send_json({"type": "error", "error": "Agent not found"})
                        continue

                    task_rec = TaskRecord(
                        agent_id=agent_id,
                        directive=directive,
                        status="pending",
                    )
                    session.add(task_rec)
                    await session.commit()
                    await session.refresh(task_rec)

                    await ws.send_json({
                        "type": "task_created",
                        "task_id": task_rec.id,
                        "agent_id": agent_id,
                        "agent_name": agent_rec.name,
                        "directive": directive,
                        "status": "pending",
                    })

                elif action == "create_task":
                    directive = payload.get("directive", "").strip()
                    if not directive:
                        await ws.send_json({"type": "error", "error": "Task description is required"})
                        continue

                    board = payload.get("board", Board.BACKLOG)
                    priority = payload.get("priority", "medium")
                    agent_id = payload.get("agent_id")
                    agent_name = "Unassigned"

                    if agent_id:
                        agent_rec = await session.get(AgentRecord, agent_id)
                        if agent_rec:
                            agent_name = agent_rec.name
                        else:
                            agent_id = None

                    task_rec = TaskRecord(
                        agent_id=agent_id,
                        directive=directive,
                        status="pending",
                        board=board,
                        priority=priority,
                    )
                    session.add(task_rec)
                    await session.commit()
                    await session.refresh(task_rec)

                    await ws.send_json({
                        "type": "task_created",
                        "task_id": task_rec.id,
                        "agent_id": agent_id,
                        "agent_name": agent_name,
                        "directive": directive,
                        "status": "pending",
                        "board": board,
                    })
                    await ws.send_json({
                        "type": "agent_message",
                        "agent_name": "System",
                        "content": f"Task created: \"{directive}\" on {board.replace('_', ' ')} board.",
                    })

                elif action == "remove_task":
                    task_id = payload.get("task_id")
                    if not task_id:
                        await ws.send_json({"type": "error", "error": "task_id required"})
                        continue

                    task_rec = await session.get(TaskRecord, task_id)
                    if not task_rec:
                        await ws.send_json({"type": "error", "error": "Task not found"})
                        continue

                    if task_rec.status == "in_progress":
                        await ws.send_json({"type": "error", "error": "Cannot remove a task that is in progress"})
                        continue

                    await session.delete(task_rec)
                    await session.commit()

                    await ws.send_json({
                        "type": "task_removed",
                        "task_id": task_id,
                    })

                elif action == "update_task_status":
                    task_id = payload.get("task_id")
                    new_status = payload.get("status")
                    feedback = payload.get("feedback")

                    if not task_id or not new_status:
                        await ws.send_json({"type": "error", "error": "task_id and status required"})
                        continue

                    task_rec = await session.get(TaskRecord, task_id)
                    if not task_rec:
                        await ws.send_json({"type": "error", "error": "Task not found"})
                        continue

                    task_rec.status = new_status
                    if feedback:
                        task_rec.result = feedback
                    task_rec.updated_at = datetime.utcnow()
                    await session.commit()

                    await ws.send_json({
                        "type": "task_updated",
                        "task_id": task_id,
                        "status": new_status,
                    })

    except WebSocketDisconnect:
        pass
    except Exception as e:
        try:
            await ws.send_json({"type": "error", "error": str(e)})
        except Exception:
            pass
