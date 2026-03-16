from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, EmailStr
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from backend.db.database import get_session
from backend.db.models import WaitlistRecord

router = APIRouter()


class WaitlistCreate(BaseModel):
    email: EmailStr
    name: str | None = None
    source: str | None = "landing"


class WaitlistOut(BaseModel):
    id: str
    email: str
    name: str | None
    source: str | None
    created_at: str


def _to_out(record: WaitlistRecord) -> WaitlistOut:
    return WaitlistOut(
        id=record.id,
        email=record.email,
        name=record.name,
        source=record.source,
        created_at=record.created_at.isoformat() if record.created_at else "",
    )


@router.post("")
async def join_waitlist(
    body: WaitlistCreate, session: AsyncSession = Depends(get_session)
) -> WaitlistOut:
    existing = await session.execute(
        select(WaitlistRecord).where(WaitlistRecord.email == body.email)
    )
    if existing.scalar_one_or_none():
        raise HTTPException(409, "This email is already on the waiting list")

    record = WaitlistRecord(
        email=body.email,
        name=body.name,
        source=body.source,
    )
    session.add(record)
    await session.commit()
    await session.refresh(record)
    return _to_out(record)


@router.get("")
async def list_waitlist(
    session: AsyncSession = Depends(get_session),
) -> dict:
    result = await session.execute(
        select(WaitlistRecord).order_by(WaitlistRecord.created_at.desc())
    )
    records = result.scalars().all()

    count_result = await session.execute(select(func.count(WaitlistRecord.id)))
    total = count_result.scalar() or 0

    return {
        "total": total,
        "entries": [_to_out(r) for r in records],
    }
