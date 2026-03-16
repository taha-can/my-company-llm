from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select, delete
from sqlalchemy.ext.asyncio import AsyncSession

from backend.db.database import get_session
from backend.db.models import CredentialRecord
from backend.engine.integrations import INTEGRATIONS

router = APIRouter()


# ── Schemas ───────────────────────────────────────────

class CredentialSet(BaseModel):
    """A key-value pair for a single credential field."""
    key: str
    value: str


class SaveCredentialsRequest(BaseModel):
    integration: str
    credentials: list[CredentialSet]
    agent_id: str | None = None


class IntegrationOut(BaseModel):
    id: str
    name: str
    description: str
    icon: str
    category: str
    tool_names: list[str]
    fields: list[dict]
    configured: bool = False


class CredentialOut(BaseModel):
    integration: str
    key: str
    has_value: bool
    agent_id: str | None


def _is_google_workspace_delegated(
    integration_id: str,
    existing_keys: set[str],
    gmail_keys: set[str],
    workspace_admin_keys: set[str],
    agent_id: str | None,
) -> bool:
    if integration_id not in {"google_gmail", "google_calendar", "google_drive"}:
        return False
    if not agent_id:
        return False
    has_sender = "sender_email" in existing_keys or "sender_email" in gmail_keys
    has_workspace_admin = {"service_account_json", "admin_email"}.issubset(workspace_admin_keys)
    return has_sender and has_workspace_admin


def _is_manual_google_oauth(existing_keys: set[str]) -> bool:
    return {"client_id", "client_secret", "refresh_token"}.issubset(existing_keys)


def _integration_is_configured(
    spec,
    existing_keys: set[str],
    gmail_keys: set[str],
    workspace_admin_keys: set[str],
    agent_id: str | None,
) -> bool:
    if spec.id in {"google_gmail", "google_calendar", "google_drive"}:
        return _is_manual_google_oauth(existing_keys) or _is_google_workspace_delegated(
            spec.id,
            existing_keys,
            gmail_keys,
            workspace_admin_keys,
            agent_id,
        )

    required_keys = {f.key for f in spec.fields if f.required}
    return required_keys.issubset(existing_keys)


# ── Endpoints ─────────────────────────────────────────

@router.get("/integrations")
async def list_integrations(
    agent_id: str | None = None,
    session: AsyncSession = Depends(get_session),
) -> list[IntegrationOut]:
    """List all available integrations and whether they are configured."""
    query = select(CredentialRecord.integration, CredentialRecord.key)
    if agent_id:
        query = query.where(CredentialRecord.agent_id == agent_id)
    else:
        query = query.where(CredentialRecord.agent_id.is_(None))
    result = await session.execute(query)
    configured_keys: dict[str, set[str]] = {}
    for integration, key in result.all():
        configured_keys.setdefault(integration, set()).add(key)

    workspace_admin_result = await session.execute(
        select(CredentialRecord.integration, CredentialRecord.key).where(
            CredentialRecord.integration == "google_workspace_admin",
            CredentialRecord.agent_id.is_(None),
        )
    )
    workspace_admin_keys = {key for _integration, key in workspace_admin_result.all()}

    out = []
    gmail_keys = configured_keys.get("google_gmail", set())
    for spec in INTEGRATIONS.values():
        existing_keys = configured_keys.get(spec.id, set())
        is_configured = _integration_is_configured(
            spec,
            existing_keys,
            gmail_keys,
            workspace_admin_keys,
            agent_id,
        )

        out.append(IntegrationOut(
            id=spec.id,
            name=spec.name,
            description=spec.description,
            icon=spec.icon,
            category=spec.category,
            tool_names=spec.tool_names,
            fields=[
                {
                    "key": f.key,
                    "label": f.label,
                    "placeholder": f.placeholder,
                    "secret": f.secret,
                    "required": f.required,
                    "help_text": f.help_text,
                    "has_value": f.key in existing_keys,
                }
                for f in spec.fields
            ],
            configured=is_configured,
        ))

    return out


@router.get("/{integration}")
async def get_credentials(
    integration: str,
    agent_id: str | None = None,
    session: AsyncSession = Depends(get_session),
) -> list[CredentialOut]:
    """Get credential status for an integration (never exposes actual values)."""
    if integration not in INTEGRATIONS:
        raise HTTPException(404, f"Unknown integration: {integration}")

    query = select(CredentialRecord).where(CredentialRecord.integration == integration)
    if agent_id:
        query = query.where(CredentialRecord.agent_id == agent_id)
    else:
        query = query.where(CredentialRecord.agent_id.is_(None))

    result = await session.execute(query)
    records = result.scalars().all()

    return [
        CredentialOut(
            integration=r.integration,
            key=r.key,
            has_value=bool(r.value),
            agent_id=r.agent_id,
        )
        for r in records
    ]


@router.post("")
async def save_credentials(
    body: SaveCredentialsRequest,
    session: AsyncSession = Depends(get_session),
):
    """Save (upsert) credentials for an integration."""
    if body.integration not in INTEGRATIONS:
        raise HTTPException(400, f"Unknown integration: {body.integration}")

    spec = INTEGRATIONS[body.integration]
    valid_keys = {f.key for f in spec.fields}

    for cred in body.credentials:
        if cred.key not in valid_keys:
            raise HTTPException(400, f"Unknown credential key '{cred.key}' for {body.integration}")

    for cred in body.credentials:
        if not cred.value.strip():
            continue

        query = (
            select(CredentialRecord)
            .where(CredentialRecord.integration == body.integration)
            .where(CredentialRecord.key == cred.key)
        )
        if body.agent_id:
            query = query.where(CredentialRecord.agent_id == body.agent_id)
        else:
            query = query.where(CredentialRecord.agent_id.is_(None))

        result = await session.execute(query)
        existing = result.scalar_one_or_none()

        if existing:
            existing.value = cred.value
        else:
            record = CredentialRecord(
                integration=body.integration,
                key=cred.key,
                value=cred.value,
                agent_id=body.agent_id,
            )
            session.add(record)

    await session.commit()
    return {"success": True, "integration": body.integration}


@router.delete("/{integration}")
async def delete_credentials(
    integration: str,
    agent_id: str | None = None,
    session: AsyncSession = Depends(get_session),
):
    """Delete all credentials for an integration."""
    query = delete(CredentialRecord).where(CredentialRecord.integration == integration)
    if agent_id:
        query = query.where(CredentialRecord.agent_id == agent_id)
    else:
        query = query.where(CredentialRecord.agent_id.is_(None))

    await session.execute(query)
    await session.commit()
    return {"success": True, "deleted": integration}
