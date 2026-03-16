from __future__ import annotations

import json

from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from backend.db.database import get_session
from backend.db.models import AgentRecord, CompanySettingsRecord, DepartmentRecord
from backend.tools.base import merge_with_default_tools

router = APIRouter()

DEFAULTS = {
    "company_name": "",
    "company_description": "",
    "industry": "",
    "brand_voice": "",
    "workspace_provider": "",
    "workspace_domain": "",
}


class CompanySettings(BaseModel):
    company_name: str = ""
    company_description: str = ""
    industry: str = ""
    brand_voice: str = ""
    is_onboarded: bool = False
    workspace_provider: str = ""
    workspace_domain: str = ""


class CompanySetupRequest(BaseModel):
    company_name: str
    company_description: str = ""
    industry: str = ""
    brand_voice: str = ""


class OnboardingAgent(BaseModel):
    name: str
    role: str


class OnboardingSetupRequest(BaseModel):
    company_name: str
    company_description: str = ""
    industry: str = ""
    department_name: str
    agents: list[OnboardingAgent]


class OnboardingResult(BaseModel):
    company: CompanySettings
    department_id: str
    department_name: str
    agents_created: int


@router.get("")
async def get_company_settings(
    session: AsyncSession = Depends(get_session),
) -> CompanySettings:
    result = await session.execute(select(CompanySettingsRecord))
    rows = {r.key: r.value for r in result.scalars().all()}

    return CompanySettings(
        company_name=rows.get("company_name", ""),
        company_description=rows.get("company_description", ""),
        industry=rows.get("industry", ""),
        brand_voice=rows.get("brand_voice", ""),
        is_onboarded=bool(rows.get("company_name", "")),
        workspace_provider=rows.get("workspace_provider", ""),
        workspace_domain=rows.get("workspace_domain", ""),
    )


@router.post("")
async def save_company_settings(
    body: CompanySetupRequest,
    session: AsyncSession = Depends(get_session),
) -> CompanySettings:
    data = body.model_dump()

    for key, value in data.items():
        result = await session.execute(
            select(CompanySettingsRecord).where(CompanySettingsRecord.key == key)
        )
        existing = result.scalar_one_or_none()

        if existing:
            existing.value = str(value)
        else:
            session.add(CompanySettingsRecord(key=key, value=str(value)))

    await session.commit()

    return CompanySettings(
        company_name=data["company_name"],
        company_description=data.get("company_description", ""),
        industry=data.get("industry", ""),
        brand_voice=data.get("brand_voice", ""),
        is_onboarded=bool(data["company_name"]),
    )


@router.post("/onboarding", response_model=OnboardingResult, status_code=201)
async def onboarding_setup(
    body: OnboardingSetupRequest,
    session: AsyncSession = Depends(get_session),
) -> OnboardingResult:
    """Complete onboarding: save company info, create department, and create agents."""

    company_fields = {
        "company_name": body.company_name,
        "company_description": body.company_description,
        "industry": body.industry,
    }
    for key, value in company_fields.items():
        result = await session.execute(
            select(CompanySettingsRecord).where(CompanySettingsRecord.key == key)
        )
        existing = result.scalar_one_or_none()
        if existing:
            existing.value = str(value)
        else:
            session.add(CompanySettingsRecord(key=key, value=str(value)))

    dept_name = body.department_name.strip().lower()
    existing_dept = await session.execute(
        select(DepartmentRecord).where(DepartmentRecord.name == dept_name)
    )
    dept = existing_dept.scalar_one_or_none()
    if not dept:
        dept = DepartmentRecord(name=dept_name, description="")
        session.add(dept)
        await session.flush()

    lead_agent: AgentRecord | None = None
    agents_created = 0

    for i, agent_data in enumerate(body.agents):
        is_lead = i == 0 and len(body.agents) > 1
        agent = AgentRecord(
            name=agent_data.name,
            role=agent_data.role,
            goal=f"{agent_data.role} at {body.company_name}",
            system_prompt=f"You are {agent_data.name}, a {agent_data.role} in the {dept_name} department at {body.company_name}.",
            agent_type="lead" if is_lead else "worker",
            llm_model="gpt-4o-mini",
            tools=json.dumps(merge_with_default_tools([])),
            department=dept_name,
            parent_agent_id=lead_agent.id if lead_agent and not is_lead else None,
            status="idle",
        )
        session.add(agent)
        if is_lead:
            await session.flush()
            lead_agent = agent
        agents_created += 1

    await session.commit()

    company = CompanySettings(
        company_name=body.company_name,
        company_description=body.company_description,
        industry=body.industry,
        is_onboarded=True,
    )

    return OnboardingResult(
        company=company,
        department_id=dept.id,
        department_name=dept.name,
        agents_created=agents_created,
    )


class WorkspaceSettingsRequest(BaseModel):
    workspace_provider: str = ""  # "google" | "microsoft" | ""
    workspace_domain: str = ""    # e.g. "company.com"


class WorkspaceSettingsOut(BaseModel):
    workspace_provider: str
    workspace_domain: str


@router.get("/workspace")
async def get_workspace_settings(
    session: AsyncSession = Depends(get_session),
) -> WorkspaceSettingsOut:
    result = await session.execute(select(CompanySettingsRecord))
    rows = {r.key: r.value for r in result.scalars().all()}
    return WorkspaceSettingsOut(
        workspace_provider=rows.get("workspace_provider", ""),
        workspace_domain=rows.get("workspace_domain", ""),
    )


@router.post("/workspace")
async def save_workspace_settings(
    body: WorkspaceSettingsRequest,
    session: AsyncSession = Depends(get_session),
) -> WorkspaceSettingsOut:
    data = {"workspace_provider": body.workspace_provider, "workspace_domain": body.workspace_domain}

    for key, value in data.items():
        result = await session.execute(
            select(CompanySettingsRecord).where(CompanySettingsRecord.key == key)
        )
        existing = result.scalar_one_or_none()
        if existing:
            existing.value = str(value)
        else:
            session.add(CompanySettingsRecord(key=key, value=str(value)))

    await session.commit()
    return WorkspaceSettingsOut(**data)
