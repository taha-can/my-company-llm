from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, EmailStr
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from backend.db.database import get_session
from backend.db.models import UserRecord

router = APIRouter()


class UserCreate(BaseModel):
    name: str
    email: EmailStr
    role: str = "viewer"


class UserUpdate(BaseModel):
    name: str | None = None
    role: str | None = None
    status: str | None = None


class UserOut(BaseModel):
    id: str
    email: str
    name: str
    role: str
    avatar_url: str | None
    status: str
    invited_by: str | None
    created_at: str
    updated_at: str


VALID_ROLES = {"admin", "manager", "viewer"}
VALID_STATUSES = {"invited", "active", "disabled"}


def _to_out(record: UserRecord) -> UserOut:
    return UserOut(
        id=record.id,
        email=record.email,
        name=record.name,
        role=record.role,
        avatar_url=record.avatar_url,
        status=record.status,
        invited_by=record.invited_by,
        created_at=record.created_at.isoformat() if record.created_at else "",
        updated_at=record.updated_at.isoformat() if record.updated_at else "",
    )


@router.get("")
async def list_users(session: AsyncSession = Depends(get_session)) -> list[UserOut]:
    result = await session.execute(select(UserRecord).order_by(UserRecord.created_at))
    return [_to_out(r) for r in result.scalars().all()]


@router.post("")
async def create_user(body: UserCreate, session: AsyncSession = Depends(get_session)) -> UserOut:
    if body.role not in VALID_ROLES:
        raise HTTPException(400, f"Invalid role. Must be one of: {', '.join(VALID_ROLES)}")

    existing = await session.execute(
        select(UserRecord).where(UserRecord.email == body.email)
    )
    if existing.scalar_one_or_none():
        raise HTTPException(409, "A user with this email already exists.")

    record = UserRecord(
        name=body.name,
        email=body.email,
        role=body.role,
        status="invited",
    )
    session.add(record)
    await session.commit()
    await session.refresh(record)
    return _to_out(record)


@router.put("/{user_id}")
async def update_user(
    user_id: str, body: UserUpdate, session: AsyncSession = Depends(get_session)
) -> UserOut:
    result = await session.execute(select(UserRecord).where(UserRecord.id == user_id))
    record = result.scalar_one_or_none()
    if not record:
        raise HTTPException(404, "User not found")

    if body.name is not None:
        record.name = body.name
    if body.role is not None:
        if body.role not in VALID_ROLES:
            raise HTTPException(400, f"Invalid role. Must be one of: {', '.join(VALID_ROLES)}")
        record.role = body.role
    if body.status is not None:
        if body.status not in VALID_STATUSES:
            raise HTTPException(400, f"Invalid status. Must be one of: {', '.join(VALID_STATUSES)}")
        record.status = body.status

    await session.commit()
    await session.refresh(record)
    return _to_out(record)


@router.delete("/{user_id}")
async def delete_user(user_id: str, session: AsyncSession = Depends(get_session)):
    result = await session.execute(select(UserRecord).where(UserRecord.id == user_id))
    record = result.scalar_one_or_none()
    if not record:
        raise HTTPException(404, "User not found")

    await session.delete(record)
    await session.commit()
    return {"deleted": True}


@router.post("/{user_id}/resend-invite")
async def resend_invite(user_id: str, session: AsyncSession = Depends(get_session)):
    result = await session.execute(select(UserRecord).where(UserRecord.id == user_id))
    record = result.scalar_one_or_none()
    if not record:
        raise HTTPException(404, "User not found")

    record.status = "invited"
    await session.commit()

    # If Gmail is configured, attempt to send an invitation email
    try:
        import base64
        from email.mime.text import MIMEText

        from backend.engine.credentials import get_credentials
        from backend.tools.gmail import _resolve_gmail_service

        ws_creds = await get_credentials("google_workspace_admin")
        explicit_sender = ws_creds.get("admin_email")
        service, sender_email = await _resolve_gmail_service(
            None,
            explicit_sender_email=explicit_sender,
        )
        if service:
            msg = MIMEText(
                f"You have been invited to join the workspace as a {record.role}.\n\n"
                "Please contact your administrator for access details."
            )
            msg["to"] = record.email
            msg["subject"] = "You've been invited to the my-company-llm workspace"
            if sender_email:
                msg["from"] = sender_email
            raw = base64.urlsafe_b64encode(msg.as_bytes()).decode()
            service.users().messages().send(userId="me", body={"raw": raw}).execute()
            return {"success": True, "email_sent": True}
    except Exception:
        pass

    return {"success": True, "email_sent": False}
