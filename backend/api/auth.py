from __future__ import annotations

import hashlib
import hmac
import json
import time
import base64
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException, Header, Cookie
from pydantic import BaseModel, EmailStr
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from backend.config import settings
from backend.db.database import get_session
from backend.db.models import UserRecord
from backend.engine.credentials import get_credentials

router = APIRouter()


def _hash_password(password: str) -> str:
    import secrets

    salt = secrets.token_hex(16)
    h = hashlib.pbkdf2_hmac("sha256", password.encode(), salt.encode(), 100_000)
    return f"{salt}${h.hex()}"


def _verify_password(password: str, password_hash: str) -> bool:
    try:
        salt, h = password_hash.split("$", 1)
        computed = hashlib.pbkdf2_hmac("sha256", password.encode(), salt.encode(), 100_000)
        return hmac.compare_digest(computed.hex(), h)
    except Exception:
        return False


def _create_jwt(user_id: str, email: str) -> str:
    header = base64.urlsafe_b64encode(json.dumps({"alg": "HS256", "typ": "JWT"}).encode()).rstrip(b"=")
    now = int(time.time())
    payload_data = {
        "sub": user_id,
        "email": email,
        "iat": now,
        "exp": now + settings.jwt_expire_minutes * 60,
    }
    payload = base64.urlsafe_b64encode(json.dumps(payload_data).encode()).rstrip(b"=")
    signing_input = header + b"." + payload
    sig = hmac.new(settings.jwt_secret.encode(), signing_input, hashlib.sha256).digest()
    signature = base64.urlsafe_b64encode(sig).rstrip(b"=")
    return (signing_input + b"." + signature).decode()


def _decode_jwt(token: str) -> dict:
    try:
        parts = token.split(".")
        if len(parts) != 3:
            raise ValueError("bad token")

        signing_input = (parts[0] + "." + parts[1]).encode()
        sig = base64.urlsafe_b64decode(parts[2] + "==")
        expected = hmac.new(settings.jwt_secret.encode(), signing_input, hashlib.sha256).digest()
        if not hmac.compare_digest(sig, expected):
            raise ValueError("bad signature")

        payload_bytes = base64.urlsafe_b64decode(parts[1] + "==")
        payload = json.loads(payload_bytes)

        if payload.get("exp", 0) < time.time():
            raise ValueError("token expired")

        return payload
    except Exception as exc:
        raise HTTPException(401, "Invalid or expired token") from exc


async def get_current_user(
    authorization: str = Header(None),
    fact_token: str | None = Cookie(default=None),
    session: AsyncSession = Depends(get_session),
) -> UserRecord:
    token: str | None = None
    if authorization and authorization.startswith("Bearer "):
        token = authorization[7:]
    elif fact_token:
        token = fact_token

    if not token:
        raise HTTPException(401, "Missing authentication token")

    payload = _decode_jwt(token)
    result = await session.execute(
        select(UserRecord).where(UserRecord.id == payload["sub"])
    )
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(401, "User not found")
    return user


class RegisterBody(BaseModel):
    name: str
    email: EmailStr
    password: str


class LoginBody(BaseModel):
    email: EmailStr
    password: str


class GoogleLoginBody(BaseModel):
    credential: str


class AuthResponse(BaseModel):
    token: str
    user: dict


class GoogleSignInConfig(BaseModel):
    client_id: str | None
    configured: bool


def _user_dict(record: UserRecord) -> dict:
    return {
        "id": record.id,
        "email": record.email,
        "name": record.name,
        "role": record.role,
        "avatar_url": record.avatar_url,
        "status": record.status,
    }


async def _resolve_google_client_id() -> str | None:
    if settings.google_client_id:
        return settings.google_client_id

    for integration in ("google_calendar", "google_gmail", "google_drive"):
        creds = await get_credentials(integration)
        client_id = creds.get("client_id")
        if client_id:
            return client_id

    return None


@router.post("/register")
async def register(body: RegisterBody, session: AsyncSession = Depends(get_session)) -> AuthResponse:
    if len(body.password) < 8:
        raise HTTPException(400, "Password must be at least 8 characters")

    existing = await session.execute(
        select(UserRecord).where(UserRecord.email == body.email)
    )
    if existing.scalar_one_or_none():
        raise HTTPException(409, "An account with this email already exists")

    record = UserRecord(
        name=body.name,
        email=body.email,
        password_hash=_hash_password(body.password),
        role="admin",
        auth_provider="email",
        status="active",
    )
    session.add(record)
    await session.commit()
    await session.refresh(record)

    token = _create_jwt(record.id, record.email)
    return AuthResponse(token=token, user=_user_dict(record))


@router.post("/login")
async def login(body: LoginBody, session: AsyncSession = Depends(get_session)) -> AuthResponse:
    result = await session.execute(
        select(UserRecord).where(UserRecord.email == body.email)
    )
    record = result.scalar_one_or_none()
    if not record or not record.password_hash:
        raise HTTPException(401, "Invalid email or password")
    if not _verify_password(body.password, record.password_hash):
        raise HTTPException(401, "Invalid email or password")

    record.status = "active"
    await session.commit()

    token = _create_jwt(record.id, record.email)
    return AuthResponse(token=token, user=_user_dict(record))


@router.post("/google")
async def google_login(body: GoogleLoginBody, session: AsyncSession = Depends(get_session)) -> AuthResponse:
    """Exchange a Google ID token (from Sign In with Google) for a JWT."""
    try:
        payload_part = body.credential.split(".")[1]
        payload_part += "=" * (4 - len(payload_part) % 4)
        payload = json.loads(base64.urlsafe_b64decode(payload_part))
    except Exception as exc:
        raise HTTPException(400, "Invalid Google credential") from exc

    email = payload.get("email")
    name = payload.get("name", "")
    picture = payload.get("picture")

    if not email:
        raise HTTPException(400, "Google credential missing email")

    result = await session.execute(
        select(UserRecord).where(UserRecord.email == email)
    )
    record = result.scalar_one_or_none()

    if record:
        if picture and record.avatar_url != picture:
            record.avatar_url = picture
        record.status = "active"
        await session.commit()
        await session.refresh(record)
    else:
        record = UserRecord(
            name=name,
            email=email,
            auth_provider="google",
            avatar_url=picture,
            role="admin",
            status="active",
        )
        session.add(record)
        await session.commit()
        await session.refresh(record)

    token = _create_jwt(record.id, record.email)
    return AuthResponse(token=token, user=_user_dict(record))


@router.get("/me")
async def get_me(user: UserRecord = Depends(get_current_user)):
    return _user_dict(user)


@router.get("/google/config", response_model=GoogleSignInConfig)
async def get_google_signin_config() -> GoogleSignInConfig:
    client_id = await _resolve_google_client_id()
    return GoogleSignInConfig(client_id=client_id, configured=bool(client_id))
