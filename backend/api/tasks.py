from __future__ import annotations

import json
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from backend.db.database import get_session
from backend.db.models import AgentRecord, BoardRecord, LabelRecord, MessageRecord, TaskRecord
from backend.models.task import ApprovalAction, Board, DEFAULT_BOARDS, LabelOut, MessageOut, TaskOut

router = APIRouter()


def _parse_labels(rec: TaskRecord) -> list[str]:
    try:
        return json.loads(rec.labels) if rec.labels else []
    except (json.JSONDecodeError, TypeError):
        return []


def _task_to_out(
    rec: TaskRecord,
    agent_name: str = "",
    subtask_count: int = 0,
    comment_count: int = 0,
) -> TaskOut:
    return TaskOut(
        id=rec.id,
        agent_id=rec.agent_id,
        agent_name=agent_name,
        directive=rec.directive,
        description=rec.description or "",
        status=rec.status,
        board=rec.board or Board.BACKLOG,
        priority=rec.priority or "medium",
        labels=_parse_labels(rec),
        due_date=rec.due_date,
        result=rec.result,
        parent_task_id=rec.parent_task_id,
        subtask_count=subtask_count,
        comment_count=comment_count,
        created_at=rec.created_at,
        updated_at=rec.updated_at,
    )


async def _enrich_task(session: AsyncSession, rec: TaskRecord) -> TaskOut:
    """Build a TaskOut with agent name, subtask count, and comment count."""
    agent_name = "Unassigned"
    if rec.agent_id:
        agent = await session.get(AgentRecord, rec.agent_id)
        if agent:
            agent_name = agent.name

    sub_result = await session.execute(
        select(func.count(TaskRecord.id)).where(TaskRecord.parent_task_id == rec.id)
    )
    subtask_count = sub_result.scalar() or 0

    msg_result = await session.execute(
        select(func.count(MessageRecord.id)).where(MessageRecord.task_id == rec.id)
    )
    comment_count = msg_result.scalar() or 0

    return _task_to_out(rec, agent_name, subtask_count, comment_count)


@router.get("", response_model=list[TaskOut])
async def list_tasks(
    status: str | None = None,
    board: str | None = None,
    agent_id: str | None = None,
    priority: str | None = None,
    search: str | None = None,
    label: str | None = None,
    limit: int = 200,
    session: AsyncSession = Depends(get_session),
):
    query = (
        select(TaskRecord, AgentRecord.name)
        .outerjoin(AgentRecord, TaskRecord.agent_id == AgentRecord.id)
        .where(TaskRecord.parent_task_id.is_(None))
        .order_by(TaskRecord.created_at.desc())
        .limit(limit)
    )

    if status:
        query = query.where(TaskRecord.status == status)
    if board:
        query = query.where(TaskRecord.board == board)
    if agent_id:
        query = query.where(TaskRecord.agent_id == agent_id)
    if priority:
        query = query.where(TaskRecord.priority == priority)
    if search:
        query = query.where(TaskRecord.directive.ilike(f"%{search}%"))
    if label:
        query = query.where(TaskRecord.labels.ilike(f'%"{label}"%'))

    result = await session.execute(query)
    tasks = []
    for row in result.all():
        rec = row[0]
        name = row[1] or "Unassigned"

        sub_result = await session.execute(
            select(func.count(TaskRecord.id)).where(TaskRecord.parent_task_id == rec.id)
        )
        subtask_count = sub_result.scalar() or 0

        msg_result = await session.execute(
            select(func.count(MessageRecord.id)).where(MessageRecord.task_id == rec.id)
        )
        comment_count = msg_result.scalar() or 0

        tasks.append(_task_to_out(rec, name, subtask_count, comment_count))

    return tasks


# ── Boards ────────────────────────────────────────────

@router.get("/boards", response_model=list[str])
async def list_boards(session: AsyncSession = Depends(get_session)):
    task_result = await session.execute(select(TaskRecord.board).distinct())
    task_boards = [row[0] for row in task_result.all() if row[0]]

    saved_result = await session.execute(
        select(BoardRecord.name).order_by(BoardRecord.created_at)
    )
    saved_boards = [row[0] for row in saved_result.all()]

    return list(dict.fromkeys(DEFAULT_BOARDS + saved_boards + task_boards))


@router.post("/boards", response_model=dict)
async def create_board(body: dict, session: AsyncSession = Depends(get_session)):
    name = body.get("name", "").strip().lower().replace(" ", "_")
    if not name:
        raise HTTPException(400, "Board name is required")

    existing = await session.execute(select(BoardRecord).where(BoardRecord.name == name))
    if existing.scalar_one_or_none():
        return {"name": name, "created": False}

    session.add(BoardRecord(name=name))
    await session.commit()
    return {"name": name, "created": True}


@router.delete("/boards/{board_name}")
async def delete_board(board_name: str, session: AsyncSession = Depends(get_session)):
    if board_name in DEFAULT_BOARDS:
        raise HTTPException(400, "Cannot delete a default board")

    result = await session.execute(select(BoardRecord).where(BoardRecord.name == board_name))
    rec = result.scalar_one_or_none()
    if rec:
        await session.delete(rec)
        await session.commit()
    return {"deleted": True}


# ── Labels ────────────────────────────────────────────

@router.get("/labels", response_model=list[LabelOut])
async def list_labels(session: AsyncSession = Depends(get_session)):
    result = await session.execute(select(LabelRecord).order_by(LabelRecord.name))
    return [
        LabelOut(id=r.id, name=r.name, color=r.color, created_at=r.created_at)
        for r in result.scalars().all()
    ]


@router.post("/labels", response_model=LabelOut, status_code=201)
async def create_label(body: dict, session: AsyncSession = Depends(get_session)):
    name = body.get("name", "").strip()
    color = body.get("color", "#6366f1").strip()
    if not name:
        raise HTTPException(400, "Label name is required")

    existing = await session.execute(select(LabelRecord).where(LabelRecord.name == name))
    if existing.scalar_one_or_none():
        raise HTTPException(409, f"Label '{name}' already exists")

    rec = LabelRecord(name=name, color=color)
    session.add(rec)
    await session.commit()
    await session.refresh(rec)
    return LabelOut(id=rec.id, name=rec.name, color=rec.color, created_at=rec.created_at)


@router.delete("/labels/{label_id}")
async def delete_label(label_id: str, session: AsyncSession = Depends(get_session)):
    rec = await session.get(LabelRecord, label_id)
    if not rec:
        raise HTTPException(404, "Label not found")
    await session.delete(rec)
    await session.commit()
    return {"deleted": True}


# ── Task CRUD ─────────────────────────────────────────

@router.get("/{task_id}", response_model=TaskOut)
async def get_task(task_id: str, session: AsyncSession = Depends(get_session)):
    rec = await session.get(TaskRecord, task_id)
    if not rec:
        raise HTTPException(404, "Task not found")
    return await _enrich_task(session, rec)


@router.get("/{task_id}/subtasks", response_model=list[TaskOut])
async def get_subtasks(task_id: str, session: AsyncSession = Depends(get_session)):
    result = await session.execute(
        select(TaskRecord, AgentRecord.name)
        .outerjoin(AgentRecord, TaskRecord.agent_id == AgentRecord.id)
        .where(TaskRecord.parent_task_id == task_id)
        .order_by(TaskRecord.created_at.asc())
    )
    return [_task_to_out(row[0], agent_name=row[1] or "Unassigned") for row in result.all()]


@router.get("/{task_id}/messages", response_model=list[MessageOut])
async def get_task_messages(task_id: str, session: AsyncSession = Depends(get_session)):
    result = await session.execute(
        select(MessageRecord, AgentRecord.name)
        .outerjoin(AgentRecord, MessageRecord.agent_id == AgentRecord.id)
        .where(MessageRecord.task_id == task_id)
        .order_by(MessageRecord.created_at)
    )
    return [
        MessageOut(
            id=row[0].id, task_id=row[0].task_id, role=row[0].role,
            agent_id=row[0].agent_id, agent_name=row[1],
            content=row[0].content, created_at=row[0].created_at,
        )
        for row in result.all()
    ]


@router.post("/{task_id}/comments", response_model=MessageOut)
async def add_task_comment(
    task_id: str, body: dict, session: AsyncSession = Depends(get_session),
):
    rec = await session.get(TaskRecord, task_id)
    if not rec:
        raise HTTPException(404, "Task not found")

    content = body.get("content", "").strip()
    if not content:
        raise HTTPException(400, "Comment content is required")

    msg = MessageRecord(
        task_id=task_id,
        role="ceo",
        content=content,
    )
    session.add(msg)
    rec.updated_at = datetime.utcnow()
    await session.commit()
    await session.refresh(msg)

    return MessageOut(
        id=msg.id, task_id=msg.task_id, role=msg.role,
        agent_id=msg.agent_id, agent_name=None,
        content=msg.content, created_at=msg.created_at,
    )


@router.post("", response_model=TaskOut)
async def create_task(body: dict, session: AsyncSession = Depends(get_session)):
    directive = body.get("directive", "")
    if not directive:
        raise HTTPException(400, "directive is required")

    agent_id = body.get("agent_id")
    board = body.get("board", Board.BACKLOG)
    priority = body.get("priority", "medium")
    description = body.get("description", "")
    labels = body.get("labels", [])
    parent_task_id = body.get("parent_task_id")
    due_date_raw = body.get("due_date")
    due_date = datetime.fromisoformat(due_date_raw) if due_date_raw else None

    if agent_id:
        agent = await session.get(AgentRecord, agent_id)
        if not agent:
            raise HTTPException(404, "Agent not found")

    rec = TaskRecord(
        agent_id=agent_id,
        directive=directive,
        description=description,
        board=board,
        priority=priority,
        labels=json.dumps(labels),
        due_date=due_date,
        parent_task_id=parent_task_id,
        status="pending",
    )
    session.add(rec)
    await session.commit()
    await session.refresh(rec)
    return await _enrich_task(session, rec)


@router.put("/{task_id}", response_model=TaskOut)
async def update_task(task_id: str, body: dict, session: AsyncSession = Depends(get_session)):
    rec = await session.get(TaskRecord, task_id)
    if not rec:
        raise HTTPException(404, "Task not found")

    if "board" in body:
        rec.board = body["board"]
    if "directive" in body:
        rec.directive = body["directive"]
    if "description" in body:
        rec.description = body["description"]
    if "agent_id" in body:
        rec.agent_id = body["agent_id"] or None
    if "status" in body:
        rec.status = body["status"]
    if "priority" in body:
        rec.priority = body["priority"]
    if "labels" in body:
        rec.labels = json.dumps(body["labels"])
    if "due_date" in body:
        raw = body["due_date"]
        rec.due_date = datetime.fromisoformat(raw) if raw else None
    if "result" in body:
        rec.result = body["result"]

    rec.updated_at = datetime.utcnow()
    await session.commit()
    await session.refresh(rec)
    return await _enrich_task(session, rec)


@router.delete("/{task_id}")
async def delete_task(task_id: str, session: AsyncSession = Depends(get_session)):
    rec = await session.get(TaskRecord, task_id)
    if not rec:
        raise HTTPException(404, "Task not found")
    if rec.status == "in_progress":
        raise HTTPException(400, "Cannot delete a task that is in progress")
    await session.delete(rec)
    await session.commit()
    return {"deleted": True}


@router.get("/by-agent/{agent_id}", response_model=list[TaskOut])
async def list_tasks_by_agent(agent_id: str, session: AsyncSession = Depends(get_session)):
    result = await session.execute(
        select(TaskRecord, AgentRecord.name)
        .outerjoin(AgentRecord, TaskRecord.agent_id == AgentRecord.id)
        .where(TaskRecord.agent_id == agent_id)
        .order_by(TaskRecord.created_at.desc())
        .limit(50)
    )
    return [_task_to_out(row[0], agent_name=row[1] or "Unassigned") for row in result.all()]


@router.post("/{task_id}/approve", response_model=TaskOut)
async def approve_or_reject_task(
    task_id: str, body: ApprovalAction, session: AsyncSession = Depends(get_session),
):
    rec = await session.get(TaskRecord, task_id)
    if not rec:
        raise HTTPException(404, "Task not found")
    if rec.status != "awaiting_approval":
        raise HTTPException(400, "Task is not awaiting approval")

    if body.action == "approve":
        rec.status = "approved"
        rec.board = Board.DONE
    else:
        rec.status = "rejected"
        rec.board = Board.DONE
        if body.feedback:
            rec.result = f"Rejected: {body.feedback}"

    rec.updated_at = datetime.utcnow()
    await session.commit()
    await session.refresh(rec)
    return await _enrich_task(session, rec)
