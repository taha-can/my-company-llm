from __future__ import annotations

import base64
import hashlib
import hmac
import json
from datetime import datetime, timedelta, timezone
from typing import Any
from urllib.parse import urlencode, urlparse

import httpx
from fastapi import APIRouter, Depends, HTTPException, Query, Request
from fastapi.responses import RedirectResponse
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from backend.api.auth import get_current_user
from backend.config import settings
from backend.db.database import get_session
from backend.db.models import UserOAuthConnectionRecord, UserRecord
from backend.engine.credentials import get_credentials
from backend.tools.google_auth import _build_google_service_oauth

router = APIRouter()

GOOGLE_CALENDAR_PROVIDER = "google_calendar"
GOOGLE_CALENDAR_SCOPE = "https://www.googleapis.com/auth/calendar"
GOOGLE_OAUTH_INTEGRATIONS = ("google_calendar", "google_gmail", "google_drive")


class CalendarStatusOut(BaseModel):
    configured: bool
    connected: bool
    writable: bool = False
    external_email: str | None = None


class CalendarConnectOut(BaseModel):
    url: str


class CalendarEventAttendeeOut(BaseModel):
    email: str = ""
    display_name: str | None = None
    response_status: str | None = None
    organizer: bool = False
    self: bool = False


class CalendarEventOut(BaseModel):
    id: str
    summary: str
    start: str
    end: str
    all_day: bool = False
    status: str = ""
    html_link: str | None = None
    description: str = ""
    location: str = ""
    creator_email: str | None = None
    organizer_email: str | None = None
    conference_link: str | None = None
    attendees: list[CalendarEventAttendeeOut] = Field(default_factory=list)
    color_id: str | None = None
    recurring_event_id: str | None = None
    timezone: str | None = None
    can_edit: bool = False


class CalendarEventsOut(BaseModel):
    events: list[CalendarEventOut]


class CalendarEventUpsert(BaseModel):
    summary: str
    start: str
    end: str
    all_day: bool = False
    description: str = ""
    location: str = ""
    attendees: list[str] = Field(default_factory=list)
    color_id: str | None = None
    timezone: str | None = None


def _require_admin(user: UserRecord) -> UserRecord:
    if user.role != "admin":
        raise HTTPException(403, "Calendar is only available to admin users")
    return user


def _normalize_frontend_origin(url: str | None) -> str | None:
    if not url:
        return None
    parsed = urlparse(url)
    if parsed.scheme not in {"http", "https"} or not parsed.netloc:
        return None
    return f"{parsed.scheme}://{parsed.netloc}"


def _frontend_origin_from_request(request: Request) -> str | None:
    origin = _normalize_frontend_origin(request.headers.get("origin"))
    if origin:
        return origin

    referer = request.headers.get("referer")
    return _normalize_frontend_origin(referer)


def _frontend_calendar_url(
    request: Request,
    frontend_origin: str | None = None,
    params: dict[str, str] | None = None,
) -> str:
    base_origin = (
        _normalize_frontend_origin(frontend_origin)
        or _normalize_frontend_origin(settings.frontend_app_url)
        or _frontend_origin_from_request(request)
        or "http://localhost:3000"
    )
    base = f"{base_origin.rstrip('/')}/app/calendar"
    if not params:
        return base
    return f"{base}?{urlencode(params)}"


def _callback_url(request: Request) -> str:
    return str(request.url_for("calendar_oauth_callback"))


def _encode_state(user: UserRecord, frontend_origin: str | None) -> str:
    payload = {
        "user_id": user.id,
        "frontend_origin": _normalize_frontend_origin(frontend_origin),
    }
    payload_bytes = json.dumps(payload).encode()
    encoded_payload = base64.urlsafe_b64encode(payload_bytes).rstrip(b"=")
    signature = hmac.new(settings.jwt_secret.encode(), encoded_payload, hashlib.sha256).digest()
    encoded_signature = base64.urlsafe_b64encode(signature).rstrip(b"=")
    return f"{encoded_payload.decode()}.{encoded_signature.decode()}"


def _decode_state(state: str) -> dict[str, Any]:
    try:
        encoded_payload, encoded_signature = state.split(".", 1)
        expected_signature = hmac.new(
            settings.jwt_secret.encode(),
            encoded_payload.encode(),
            hashlib.sha256,
        ).digest()
        actual_signature = base64.urlsafe_b64decode(encoded_signature + "=" * (-len(encoded_signature) % 4))
        if not hmac.compare_digest(actual_signature, expected_signature):
            raise ValueError("bad signature")

        payload_bytes = base64.urlsafe_b64decode(encoded_payload + "=" * (-len(encoded_payload) % 4))
        payload = json.loads(payload_bytes)
        if not payload.get("user_id"):
            raise ValueError("missing user")
        return payload
    except Exception as exc:
        raise HTTPException(400, "Invalid OAuth state") from exc


def _decode_google_id_token_email(id_token: str | None) -> str | None:
    if not id_token:
        return None
    try:
        payload_part = id_token.split(".")[1]
        payload_part += "=" * (-len(payload_part) % 4)
        payload = json.loads(base64.urlsafe_b64decode(payload_part))
    except Exception:
        return None
    return payload.get("email")


def _parse_iso_datetime(value: str) -> datetime:
    normalized = value.replace("Z", "+00:00")
    try:
        parsed = datetime.fromisoformat(normalized)
    except ValueError as exc:
        raise HTTPException(400, f"Invalid datetime: {value}") from exc
    if parsed.tzinfo is None:
        parsed = parsed.replace(tzinfo=timezone.utc)
    return parsed


def _format_event_datetime(event_time: dict[str, Any], is_end: bool = False) -> tuple[str, bool]:
    if "dateTime" in event_time:
        return str(event_time["dateTime"]), False

    date_value = event_time.get("date", "")
    if is_end and date_value:
        # Google returns all-day end dates as exclusive; keep the UI intuitive by
        # mapping them to the prior day.
        parsed = datetime.fromisoformat(date_value)
        date_value = (parsed.date() - timedelta(days=1)).isoformat()
    return date_value, True


def _has_write_scope(scopes: str | None) -> bool:
    if not scopes:
        return False
    scope_set = set(scopes.split())
    return GOOGLE_CALENDAR_SCOPE in scope_set


def _parse_date(value: str):
    try:
        return datetime.fromisoformat(value).date()
    except ValueError as exc:
        raise HTTPException(400, f"Invalid date: {value}") from exc


def _normalize_conference_link(item: dict[str, Any]) -> str | None:
    for entry_point in item.get("conferenceData", {}).get("entryPoints", []):
        uri = entry_point.get("uri")
        if uri:
            return uri
    return item.get("hangoutLink")


def _event_to_out(item: dict[str, Any], can_edit: bool) -> CalendarEventOut:
    start_value, all_day = _format_event_datetime(item.get("start", {}))
    end_value, _ = _format_event_datetime(item.get("end", {}), is_end=all_day)
    attendees = [
        CalendarEventAttendeeOut(
            email=attendee.get("email", ""),
            display_name=attendee.get("displayName"),
            response_status=attendee.get("responseStatus"),
            organizer=bool(attendee.get("organizer")),
            self=bool(attendee.get("self")),
        )
        for attendee in item.get("attendees", [])
    ]
    return CalendarEventOut(
        id=item["id"],
        summary=item.get("summary") or "(No title)",
        start=start_value,
        end=end_value,
        all_day=all_day,
        status=item.get("status", ""),
        html_link=item.get("htmlLink"),
        description=item.get("description", ""),
        location=item.get("location", ""),
        creator_email=item.get("creator", {}).get("email"),
        organizer_email=item.get("organizer", {}).get("email"),
        conference_link=_normalize_conference_link(item),
        attendees=attendees,
        color_id=item.get("colorId"),
        recurring_event_id=item.get("recurringEventId"),
        timezone=item.get("start", {}).get("timeZone") or item.get("end", {}).get("timeZone"),
        can_edit=can_edit,
    )


def _build_event_resource(body: CalendarEventUpsert) -> dict[str, Any]:
    summary = body.summary.strip()
    if not summary:
        raise HTTPException(400, "Event title is required")

    event_body: dict[str, Any] = {
        "summary": summary,
        "description": body.description,
        "location": body.location,
    }

    if body.color_id:
        event_body["colorId"] = body.color_id

    if body.attendees:
        event_body["attendees"] = [{"email": email} for email in body.attendees if email.strip()]

    if body.all_day:
        start_date = _parse_date(body.start)
        end_date = _parse_date(body.end)
        if end_date < start_date:
            raise HTTPException(400, "End date must be on or after start date")
        event_body["start"] = {"date": start_date.isoformat()}
        event_body["end"] = {"date": (end_date + timedelta(days=1)).isoformat()}
    else:
        start_dt = _parse_iso_datetime(body.start)
        end_dt = _parse_iso_datetime(body.end)
        if end_dt <= start_dt:
            raise HTTPException(400, "End must be after start")
        event_body["start"] = {"dateTime": start_dt.isoformat()}
        event_body["end"] = {"dateTime": end_dt.isoformat()}
        if body.timezone:
            event_body["start"]["timeZone"] = body.timezone
            event_body["end"]["timeZone"] = body.timezone

    return event_body


async def _get_connection(
    session: AsyncSession,
    user_id: str,
) -> UserOAuthConnectionRecord | None:
    result = await session.execute(
        select(UserOAuthConnectionRecord)
        .where(UserOAuthConnectionRecord.user_id == user_id)
        .where(UserOAuthConnectionRecord.provider == GOOGLE_CALENDAR_PROVIDER)
    )
    return result.scalar_one_or_none()


async def _resolve_google_oauth_settings(session: AsyncSession) -> tuple[str | None, str | None]:
    if settings.google_client_id and settings.google_client_secret:
        return settings.google_client_id, settings.google_client_secret

    for integration in GOOGLE_OAUTH_INTEGRATIONS:
        creds = await get_credentials(integration)
        client_id = creds.get("client_id")
        client_secret = creds.get("client_secret")
        if client_id and client_secret:
            return client_id, client_secret

    return None, None


def _build_google_authorize_url(client_id: str, state: str, redirect_uri: str) -> str:
    params = {
        "client_id": client_id,
        "redirect_uri": redirect_uri,
        "response_type": "code",
        "scope": GOOGLE_CALENDAR_SCOPE,
        "access_type": "offline",
        "prompt": "consent",
        "include_granted_scopes": "true",
        "state": state,
    }
    return f"https://accounts.google.com/o/oauth2/v2/auth?{urlencode(params)}"


async def _exchange_google_code(
    code: str,
    redirect_uri: str,
    client_id: str,
    client_secret: str,
) -> dict[str, Any]:
    async with httpx.AsyncClient(timeout=20) as client:
        response = await client.post(
            "https://oauth2.googleapis.com/token",
            data={
                "code": code,
                "client_id": client_id,
                "client_secret": client_secret,
                "redirect_uri": redirect_uri,
                "grant_type": "authorization_code",
            },
            headers={"Content-Type": "application/x-www-form-urlencoded"},
        )

    if response.status_code != 200:
        detail = response.text
        raise HTTPException(400, f"Google token exchange failed: {detail}")
    return response.json()


@router.get("/status", response_model=CalendarStatusOut)
async def get_calendar_status(
    user: UserRecord = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> CalendarStatusOut:
    _require_admin(user)
    connection = await _get_connection(session, user.id)
    client_id, client_secret = await _resolve_google_oauth_settings(session)
    return CalendarStatusOut(
        configured=bool(client_id and client_secret),
        connected=bool(connection and connection.refresh_token),
        writable=bool(connection and _has_write_scope(connection.scopes)),
        external_email=connection.external_email if connection else None,
    )


@router.get("/connect-url", response_model=CalendarConnectOut)
async def get_calendar_connect_url(
    request: Request,
    user: UserRecord = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> CalendarConnectOut:
    _require_admin(user)
    client_id, client_secret = await _resolve_google_oauth_settings(session)
    if not client_id or not client_secret:
        raise HTTPException(400, "Google OAuth is not configured on the server")

    frontend_origin = _frontend_origin_from_request(request)
    state = _encode_state(user, frontend_origin)
    return CalendarConnectOut(
        url=_build_google_authorize_url(
            client_id=client_id,
            state=state,
            redirect_uri=_callback_url(request),
        )
    )


@router.get("/oauth/callback", name="calendar_oauth_callback")
async def calendar_oauth_callback(
    request: Request,
    code: str | None = Query(default=None),
    state: str | None = Query(default=None),
    error: str | None = Query(default=None),
    error_description: str | None = Query(default=None),
    session: AsyncSession = Depends(get_session),
):
    frontend_origin: str | None = None
    if error:
        description = error_description or error
        return RedirectResponse(_frontend_calendar_url(request, params={"error": description}))

    if not code or not state:
        return RedirectResponse(_frontend_calendar_url(request, params={"error": "Missing OAuth response"}))

    try:
        payload = _decode_state(state)
        frontend_origin = payload.get("frontend_origin")
    except HTTPException:
        return RedirectResponse(_frontend_calendar_url(request, params={"error": "Invalid OAuth state"}))

    result = await session.execute(
        select(UserRecord).where(UserRecord.id == payload["user_id"])
    )
    user = result.scalar_one_or_none()
    if not user:
        return RedirectResponse(_frontend_calendar_url(request, frontend_origin, {"error": "User not found"}))
    if user.role != "admin":
        return RedirectResponse(_frontend_calendar_url(request, frontend_origin, {"error": "Only admins can connect a calendar"}))

    client_id, client_secret = await _resolve_google_oauth_settings(session)
    if not client_id or not client_secret:
        return RedirectResponse(_frontend_calendar_url(request, frontend_origin, {"error": "Google OAuth is not configured on the server"}))

    try:
        token_data = await _exchange_google_code(
            code,
            _callback_url(request),
            client_id,
            client_secret,
        )
    except HTTPException as exc:
        return RedirectResponse(_frontend_calendar_url(request, frontend_origin, {"error": exc.detail}))

    connection = await _get_connection(session, user.id)
    if not connection:
        connection = UserOAuthConnectionRecord(
            user_id=user.id,
            provider=GOOGLE_CALENDAR_PROVIDER,
        )
        session.add(connection)

    expires_in = token_data.get("expires_in")
    expires_at = None
    if isinstance(expires_in, (int, float)):
        expires_at = datetime.now(timezone.utc).replace(microsecond=0) + timedelta(seconds=int(expires_in))

    connection.access_token = token_data.get("access_token") or connection.access_token
    connection.refresh_token = token_data.get("refresh_token") or connection.refresh_token
    connection.token_type = token_data.get("token_type") or connection.token_type
    connection.scopes = token_data.get("scope") or connection.scopes or GOOGLE_CALENDAR_SCOPE
    connection.expires_at = expires_at
    connection.external_email = _decode_google_id_token_email(token_data.get("id_token")) or connection.external_email

    await session.commit()
    return RedirectResponse(_frontend_calendar_url(request, frontend_origin, {"connected": "1"}))


@router.get("/events", response_model=CalendarEventsOut)
async def get_calendar_events(
    start: str,
    end: str,
    user: UserRecord = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> CalendarEventsOut:
    _require_admin(user)
    connection = await _get_connection(session, user.id)
    if not connection or not connection.refresh_token:
        raise HTTPException(400, "Google Calendar is not connected")
    client_id, client_secret = await _resolve_google_oauth_settings(session)
    if not client_id or not client_secret:
        raise HTTPException(400, "Google OAuth is not configured on the server")

    start_dt = _parse_iso_datetime(start)
    end_dt = _parse_iso_datetime(end)
    if end_dt <= start_dt:
        raise HTTPException(400, "End must be after start")

    try:
        service = _build_google_service_oauth(
            "calendar",
            "v3",
            {
                "client_id": client_id,
                "client_secret": client_secret,
                "refresh_token": connection.refresh_token,
            }
        )
        result = service.events().list(
            calendarId="primary",
            timeMin=start_dt.astimezone(timezone.utc).isoformat(),
            timeMax=end_dt.astimezone(timezone.utc).isoformat(),
            singleEvents=True,
            orderBy="startTime",
            maxResults=250,
        ).execute()
    except Exception as exc:
        raise HTTPException(502, f"Failed to load Google Calendar events: {exc}") from exc

    can_edit = _has_write_scope(connection.scopes)
    events = [_event_to_out(item, can_edit=can_edit) for item in result.get("items", [])]
    return CalendarEventsOut(events=events)


@router.post("/events", response_model=CalendarEventOut)
async def create_calendar_event(
    body: CalendarEventUpsert,
    user: UserRecord = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> CalendarEventOut:
    _require_admin(user)
    connection = await _get_connection(session, user.id)
    if not connection or not connection.refresh_token:
        raise HTTPException(400, "Google Calendar is not connected")
    if not _has_write_scope(connection.scopes):
        raise HTTPException(403, "Reconnect Google Calendar with write access to create events")
    client_id, client_secret = await _resolve_google_oauth_settings(session)
    if not client_id or not client_secret:
        raise HTTPException(400, "Google OAuth is not configured on the server")

    try:
        service = _build_google_service_oauth(
            "calendar",
            "v3",
            {
                "client_id": client_id,
                "client_secret": client_secret,
                "refresh_token": connection.refresh_token,
            }
        )
        event = service.events().insert(
            calendarId="primary",
            body=_build_event_resource(body),
        ).execute()
    except Exception as exc:
        raise HTTPException(502, f"Failed to create Google Calendar event: {exc}") from exc

    return _event_to_out(event, can_edit=True)


@router.put("/events/{event_id}", response_model=CalendarEventOut)
async def update_calendar_event(
    event_id: str,
    body: CalendarEventUpsert,
    user: UserRecord = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> CalendarEventOut:
    _require_admin(user)
    connection = await _get_connection(session, user.id)
    if not connection or not connection.refresh_token:
        raise HTTPException(400, "Google Calendar is not connected")
    if not _has_write_scope(connection.scopes):
        raise HTTPException(403, "Reconnect Google Calendar with write access to edit events")
    client_id, client_secret = await _resolve_google_oauth_settings(session)
    if not client_id or not client_secret:
        raise HTTPException(400, "Google OAuth is not configured on the server")

    try:
        service = _build_google_service_oauth(
            "calendar",
            "v3",
            {
                "client_id": client_id,
                "client_secret": client_secret,
                "refresh_token": connection.refresh_token,
            }
        )
        event = service.events().update(
            calendarId="primary",
            eventId=event_id,
            body=_build_event_resource(body),
        ).execute()
    except Exception as exc:
        raise HTTPException(502, f"Failed to update Google Calendar event: {exc}") from exc

    return _event_to_out(event, can_edit=True)


@router.delete("/events/{event_id}")
async def delete_calendar_event(
    event_id: str,
    user: UserRecord = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    _require_admin(user)
    connection = await _get_connection(session, user.id)
    if not connection or not connection.refresh_token:
        raise HTTPException(400, "Google Calendar is not connected")
    if not _has_write_scope(connection.scopes):
        raise HTTPException(403, "Reconnect Google Calendar with write access to delete events")
    client_id, client_secret = await _resolve_google_oauth_settings(session)
    if not client_id or not client_secret:
        raise HTTPException(400, "Google OAuth is not configured on the server")

    try:
        service = _build_google_service_oauth(
            "calendar",
            "v3",
            {
                "client_id": client_id,
                "client_secret": client_secret,
                "refresh_token": connection.refresh_token,
            }
        )
        service.events().delete(calendarId="primary", eventId=event_id).execute()
    except Exception as exc:
        raise HTTPException(502, f"Failed to delete Google Calendar event: {exc}") from exc

    return {"deleted": True, "event_id": event_id}
