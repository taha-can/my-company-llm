"""Credential resolver: fetches integration credentials from DB for tool use."""

from __future__ import annotations

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from backend.db.database import async_session
from backend.db.models import CredentialRecord


async def get_credentials(integration: str, agent_id: str | None = None) -> dict[str, str]:
    """Fetch all credential key-value pairs for an integration.
    
    Looks up agent-specific credentials first; falls back to global (agent_id=None).
    """
    async with async_session() as session:
        creds: dict[str, str] = {}

        # Global credentials first
        global_q = (
            select(CredentialRecord)
            .where(CredentialRecord.integration == integration)
            .where(CredentialRecord.agent_id.is_(None))
        )
        result = await session.execute(global_q)
        for record in result.scalars().all():
            creds[record.key] = record.value

        # Agent-specific overrides
        if agent_id:
            agent_q = (
                select(CredentialRecord)
                .where(CredentialRecord.integration == integration)
                .where(CredentialRecord.agent_id == agent_id)
            )
            result = await session.execute(agent_q)
            for record in result.scalars().all():
                creds[record.key] = record.value

        return creds


async def has_credentials(integration: str, required_keys: list[str], agent_id: str | None = None) -> bool:
    """Check whether all required keys are present for an integration."""
    creds = await get_credentials(integration, agent_id)
    return all(k in creds and creds[k] for k in required_keys)
