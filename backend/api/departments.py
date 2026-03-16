from __future__ import annotations

from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from backend.db.database import get_session
from backend.db.models import AgentRecord, DepartmentRecord
from backend.models.department import DepartmentCreate, DepartmentOut, DepartmentUpdate

router = APIRouter()


def _record_to_out(rec: DepartmentRecord, agent_count: int = 0) -> DepartmentOut:
    return DepartmentOut(
        id=rec.id,
        name=rec.name,
        description=rec.description or "",
        agent_count=agent_count,
        created_at=rec.created_at,
        updated_at=rec.updated_at,
    )


@router.get("", response_model=list[DepartmentOut])
async def list_departments(session: AsyncSession = Depends(get_session)):
    stmt = (
        select(DepartmentRecord, func.count(AgentRecord.id).label("agent_count"))
        .outerjoin(AgentRecord, AgentRecord.department == DepartmentRecord.name)
        .group_by(DepartmentRecord.id)
        .order_by(DepartmentRecord.name)
    )
    result = await session.execute(stmt)
    return [_record_to_out(row[0], row[1]) for row in result.all()]


@router.get("/{department_id}", response_model=DepartmentOut)
async def get_department(department_id: str, session: AsyncSession = Depends(get_session)):
    rec = await session.get(DepartmentRecord, department_id)
    if not rec:
        raise HTTPException(404, "Department not found")

    count_result = await session.execute(
        select(func.count(AgentRecord.id)).where(AgentRecord.department == rec.name)
    )
    agent_count = count_result.scalar() or 0
    return _record_to_out(rec, agent_count)


@router.post("", response_model=DepartmentOut, status_code=201)
async def create_department(body: DepartmentCreate, session: AsyncSession = Depends(get_session)):
    existing = await session.execute(
        select(DepartmentRecord).where(DepartmentRecord.name == body.name)
    )
    if existing.scalar_one_or_none():
        raise HTTPException(409, f"Department '{body.name}' already exists")

    rec = DepartmentRecord(
        name=body.name,
        description=body.description,
    )
    session.add(rec)
    await session.commit()
    await session.refresh(rec)
    return _record_to_out(rec)


@router.put("/{department_id}", response_model=DepartmentOut)
async def update_department(
    department_id: str,
    body: DepartmentUpdate,
    session: AsyncSession = Depends(get_session),
):
    rec = await session.get(DepartmentRecord, department_id)
    if not rec:
        raise HTTPException(404, "Department not found")

    update_data = body.model_dump(exclude_unset=True)

    if "name" in update_data and update_data["name"] != rec.name:
        existing = await session.execute(
            select(DepartmentRecord).where(DepartmentRecord.name == update_data["name"])
        )
        if existing.scalar_one_or_none():
            raise HTTPException(409, f"Department '{update_data['name']}' already exists")

        old_name = rec.name
        agents = await session.execute(
            select(AgentRecord).where(AgentRecord.department == old_name)
        )
        for agent in agents.scalars().all():
            agent.department = update_data["name"]

    for key, value in update_data.items():
        setattr(rec, key, value)

    rec.updated_at = datetime.utcnow()
    await session.commit()
    await session.refresh(rec)

    count_result = await session.execute(
        select(func.count(AgentRecord.id)).where(AgentRecord.department == rec.name)
    )
    agent_count = count_result.scalar() or 0
    return _record_to_out(rec, agent_count)


@router.delete("/{department_id}")
async def delete_department(department_id: str, session: AsyncSession = Depends(get_session)):
    rec = await session.get(DepartmentRecord, department_id)
    if not rec:
        raise HTTPException(404, "Department not found")

    count_result = await session.execute(
        select(func.count(AgentRecord.id)).where(AgentRecord.department == rec.name)
    )
    agent_count = count_result.scalar() or 0
    if agent_count > 0:
        raise HTTPException(
            409,
            f"Cannot delete department '{rec.name}': {agent_count} agent(s) still assigned",
        )

    await session.delete(rec)
    await session.commit()
    return {"deleted": True}
