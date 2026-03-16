from __future__ import annotations

import json
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import Response
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from backend.db.database import get_session
from backend.db.models import AgentRecord, CompanySettingsRecord, CredentialRecord
from backend.engine.factory import generate_agent_definition
from backend.engine.memory import AgentMemory
from backend.models.agent import (
    AgentCreate,
    AgentDefinition,
    AgentGenerateRequest,
    AgentOut,
    AgentProvisionRequest,
    AgentUpdate,
    WorkspaceProvider,
)
from backend.tools.base import merge_with_default_tools

router = APIRouter()


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


async def _store_workspace_sender_email(
    session: AsyncSession,
    *,
    agent_id: str,
    email: str,
):
    for integration in ("google_gmail", "google_calendar", "google_drive"):
        existing = await session.execute(
            select(CredentialRecord).where(
                CredentialRecord.integration == integration,
                CredentialRecord.agent_id == agent_id,
                CredentialRecord.key == "sender_email",
            )
        )
        record = existing.scalars().first()
        if record:
            record.value = email
        else:
            session.add(CredentialRecord(
                integration=integration,
                key="sender_email",
                value=email,
                agent_id=agent_id,
            ))


@router.get("", response_model=list[AgentOut])
async def list_agents(session: AsyncSession = Depends(get_session)):
    result = await session.execute(select(AgentRecord).order_by(AgentRecord.created_at))
    records = result.scalars().all()

    agents_map: dict[str, AgentOut] = {}
    roots: list[AgentOut] = []

    for rec in records:
        defn = _record_to_definition(rec)
        agent_out = AgentOut(**defn.model_dump(), children=[])
        agents_map[rec.id] = agent_out

    for rec in records:
        agent_out = agents_map[rec.id]
        if rec.parent_agent_id and rec.parent_agent_id in agents_map:
            agents_map[rec.parent_agent_id].children.append(agent_out)
        else:
            roots.append(agent_out)

    return roots


@router.get("/flat", response_model=list[AgentDefinition])
async def list_agents_flat(session: AsyncSession = Depends(get_session)):
    result = await session.execute(select(AgentRecord).order_by(AgentRecord.created_at))
    return [_record_to_definition(r) for r in result.scalars().all()]


@router.get("/{agent_id}", response_model=AgentOut)
async def get_agent(agent_id: str, session: AsyncSession = Depends(get_session)):
    rec = await session.get(AgentRecord, agent_id)
    if not rec:
        raise HTTPException(404, "Agent not found")

    defn = _record_to_definition(rec)
    children_result = await session.execute(
        select(AgentRecord).where(AgentRecord.parent_agent_id == agent_id)
    )
    children = [
        AgentOut(**_record_to_definition(c).model_dump(), children=[])
        for c in children_result.scalars().all()
    ]

    out = AgentOut(**defn.model_dump(), children=children)

    try:
        mem = AgentMemory(agent_id)
        out_dict = out.model_dump()
        out_dict["memory_stats"] = mem.stats()
    except Exception:
        pass

    return out


@router.post("", response_model=AgentDefinition)
async def create_agent(body: AgentCreate, session: AsyncSession = Depends(get_session)):
    settings_result = await session.execute(select(CompanySettingsRecord))
    company = {r.key: r.value for r in settings_result.scalars().all()}
    if not company.get("workspace_domain"):
        raise HTTPException(
            400,
            "Workspace connection must be configured before creating agents. "
            "Go to Settings > Workspace to set up your domain.",
        )

    rec = AgentRecord(
        name=body.name,
        role=body.role,
        goal=body.goal,
        system_prompt=body.system_prompt,
        agent_type=body.agent_type.value,
        llm_model=body.llm_model,
        tools=json.dumps(merge_with_default_tools(body.tools)),
        parent_agent_id=body.parent_agent_id,
        department=body.department,
        email=body.email,
        avatar_url=body.avatar_url,
    )
    session.add(rec)
    await session.commit()
    await session.refresh(rec)
    return _record_to_definition(rec)


@router.put("/{agent_id}", response_model=AgentDefinition)
async def update_agent(
    agent_id: str,
    body: AgentUpdate,
    session: AsyncSession = Depends(get_session),
):
    rec = await session.get(AgentRecord, agent_id)
    if not rec:
        raise HTTPException(404, "Agent not found")

    update_data = body.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        if key == "tools" and value is not None:
            setattr(rec, key, json.dumps(merge_with_default_tools(value)))
        elif key == "status" and value is not None:
            setattr(rec, key, value.value)
        else:
            setattr(rec, key, value)

    rec.updated_at = datetime.utcnow()
    await session.commit()
    await session.refresh(rec)
    return _record_to_definition(rec)


@router.delete("/{agent_id}")
async def delete_agent(agent_id: str, session: AsyncSession = Depends(get_session)):
    rec = await session.get(AgentRecord, agent_id)
    if not rec:
        raise HTTPException(404, "Agent not found")

    try:
        mem = AgentMemory(agent_id)
        mem.delete_all()
    except Exception:
        pass

    await session.delete(rec)
    await session.commit()
    return {"deleted": True}


@router.post("/generate", response_model=AgentCreate)
async def generate_agent(body: AgentGenerateRequest):
    """Generate an agent definition from a natural language description."""
    return await generate_agent_definition(body.description)


@router.post("/{agent_id}/provision")
async def provision_agent(
    agent_id: str,
    body: AgentProvisionRequest,
    session: AsyncSession = Depends(get_session),
):
    """Provision workspace accounts for an AI agent (Google Workspace / M365 / Slack)."""
    rec = await session.get(AgentRecord, agent_id)
    if not rec:
        raise HTTPException(404, "Agent not found")

    results: dict = {"agent_id": agent_id, "steps": []}

    settings_result = await session.execute(
        select(CompanySettingsRecord)
    )
    company = {r.key: r.value for r in settings_result.scalars().all()}
    domain = company.get("workspace_domain", "")
    provider = company.get("workspace_provider", "")

    if body.provision_workspace and domain and provider:
        email = _generate_email(rec.name, domain)
        rec.email = email
        rec.workspace_provisioned = provider

        from backend.engine.workspace import provision_workspace_account
        ws_result = await provision_workspace_account(
            provider=provider,
            email=email,
            name=rec.name,
            department=rec.department,
            role=rec.role,
            session=session,
        )
        results["steps"].append({"step": "workspace", "provider": provider, "email": email, **ws_result})

        if ws_result.get("status") in ("provisioned", "pending") and email:
            await _store_workspace_sender_email(
                session,
                agent_id=agent_id,
                email=email,
            )
            results["steps"].append({
                "step": "email_link",
                "status": "provisioned",
                "email": email,
                "reason": "Workspace email linked for Gmail, Calendar, and Drive.",
            })
    elif body.provision_workspace and not domain:
        results["steps"].append({"step": "workspace", "status": "skipped", "reason": "No workspace domain configured"})

    if body.provision_slack:
        from backend.engine.workspace import provision_slack_account
        slack_result = await provision_slack_account(
            email=rec.email or "",
            name=rec.name,
            session=session,
        )
        if slack_result.get("member_id"):
            rec.slack_member_id = slack_result["member_id"]
        results["steps"].append({"step": "slack", **slack_result})

    if body.generate_avatar:
        from backend.engine.workspace import generate_agent_avatar
        avatar_result = await generate_agent_avatar(
            name=rec.name,
            role=rec.role,
            department=rec.department,
        )
        if avatar_result.get("avatar_url"):
            rec.avatar_url = avatar_result["avatar_url"]
        results["steps"].append({"step": "avatar", **avatar_result})

    rec.updated_at = datetime.utcnow()
    await session.commit()
    await session.refresh(rec)

    results["agent"] = _record_to_definition(rec).model_dump()
    return results


def _generate_email(name: str, domain: str) -> str:
    """Generate a workspace email from a name: 'Selin Yıldız' -> 'selin.yildiz@domain.com'."""
    import unicodedata
    import re

    normalized = unicodedata.normalize("NFKD", name.lower())
    ascii_name = normalized.encode("ascii", "ignore").decode("ascii")
    parts = ascii_name.strip().split()
    if len(parts) >= 2:
        email_local = f"{parts[0]}.{parts[-1]}"
    elif parts:
        email_local = parts[0]
    else:
        email_local = "agent"
    email_local = re.sub(r"[^a-z0-9.]", "", email_local)
    return f"{email_local}@{domain}"


@router.post("/generate-email")
async def generate_email_preview(
    body: dict,
    session: AsyncSession = Depends(get_session),
):
    """Preview what email would be generated for a given agent name."""
    name = body.get("name", "")
    settings_result = await session.execute(select(CompanySettingsRecord))
    company = {r.key: r.value for r in settings_result.scalars().all()}
    domain = company.get("workspace_domain", "")

    if not domain:
        return {"email": None, "reason": "No workspace domain configured"}

    return {"email": _generate_email(name, domain), "domain": domain}


@router.get("/avatar/initials/{initials}")
async def initials_avatar(initials: str):
    safe_initials = "".join(ch for ch in initials.upper()[:2] if ch.isalnum()) or "AI"
    svg = f"""<svg xmlns="http://www.w3.org/2000/svg" width="128" height="128" viewBox="0 0 128 128">
<rect width="128" height="128" rx="24" fill="#7c3aed"/>
<text x="64" y="76" text-anchor="middle" font-family="Inter, Arial, sans-serif" font-size="42" font-weight="700" fill="white">{safe_initials}</text>
</svg>"""
    return Response(content=svg, media_type="image/svg+xml")
