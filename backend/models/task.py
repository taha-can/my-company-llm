from __future__ import annotations

import uuid
from datetime import datetime
from enum import Enum

from pydantic import BaseModel, Field


class Board(str, Enum):
    BACKLOG = "backlog"
    IN_PROGRESS = "in_progress"
    DONE = "done"


DEFAULT_BOARDS: list[str] = [Board.BACKLOG, Board.IN_PROGRESS, Board.DONE]


class TaskStatus(str, Enum):
    PENDING = "pending"
    IN_PROGRESS = "in_progress"
    AWAITING_APPROVAL = "awaiting_approval"
    APPROVED = "approved"
    REJECTED = "rejected"
    COMPLETED = "completed"
    FAILED = "failed"


class PriorityLevel(str, Enum):
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    URGENT = "urgent"


class MessageRole(str, Enum):
    CEO = "ceo"
    AGENT = "agent"
    SYSTEM = "system"


class TaskCreate(BaseModel):
    agent_id: str | None = None
    directive: str
    description: str = ""
    board: str = Board.BACKLOG
    priority: PriorityLevel = PriorityLevel.MEDIUM
    labels: list[str] = []
    due_date: datetime | None = None
    parent_task_id: str | None = None


class TaskOut(BaseModel):
    id: str
    agent_id: str | None = None
    agent_name: str = ""
    directive: str
    description: str = ""
    status: TaskStatus
    board: str = Board.BACKLOG
    priority: PriorityLevel = PriorityLevel.MEDIUM
    labels: list[str] = []
    due_date: datetime | None = None
    result: str | None = None
    parent_task_id: str | None = None
    subtask_count: int = 0
    comment_count: int = 0
    created_at: datetime
    updated_at: datetime


class LabelOut(BaseModel):
    id: str
    name: str
    color: str
    created_at: datetime


class MessageOut(BaseModel):
    id: str
    task_id: str | None = None
    role: MessageRole
    agent_id: str | None = None
    agent_name: str | None = None
    content: str
    created_at: datetime


class ChatMessage(BaseModel):
    content: str


class ApprovalAction(BaseModel):
    action: str = Field(..., pattern="^(approve|reject)$")
    feedback: str | None = None
