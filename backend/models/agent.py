from __future__ import annotations

import uuid
from datetime import datetime
from enum import Enum

from pydantic import BaseModel, Field


class AgentType(str, Enum):
    LEAD = "lead"
    WORKER = "worker"


class AgentStatus(str, Enum):
    IDLE = "idle"
    WORKING = "working"
    ERROR = "error"
    DISABLED = "disabled"


class WorkspaceProvider(str, Enum):
    NONE = "none"
    GOOGLE = "google"
    MICROSOFT = "microsoft"


class AgentDefinition(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    role: str
    goal: str
    system_prompt: str
    agent_type: AgentType = AgentType.WORKER
    llm_model: str = "gpt-4o-mini"
    tools: list[str] = Field(default_factory=list)
    parent_agent_id: str | None = None
    department: str = "general"
    status: AgentStatus = AgentStatus.IDLE
    email: str | None = None
    avatar_url: str | None = None
    workspace_provisioned: WorkspaceProvider = WorkspaceProvider.NONE
    slack_member_id: str | None = None
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)


class AgentCreate(BaseModel):
    name: str
    role: str
    goal: str
    system_prompt: str
    agent_type: AgentType = AgentType.WORKER
    llm_model: str = "gpt-4o-mini"
    tools: list[str] = Field(default_factory=list)
    parent_agent_id: str | None = None
    department: str = "general"
    email: str | None = None
    avatar_url: str | None = None


class AgentUpdate(BaseModel):
    name: str | None = None
    role: str | None = None
    goal: str | None = None
    system_prompt: str | None = None
    llm_model: str | None = None
    tools: list[str] | None = None
    parent_agent_id: str | None = None
    department: str | None = None
    status: AgentStatus | None = None
    email: str | None = None
    avatar_url: str | None = None


class AgentGenerateRequest(BaseModel):
    description: str


class AgentProvisionRequest(BaseModel):
    agent_id: str
    provision_workspace: bool = True
    provision_slack: bool = True
    generate_avatar: bool = True


class AgentOut(AgentDefinition):
    children: list[AgentOut] = Field(default_factory=list)
