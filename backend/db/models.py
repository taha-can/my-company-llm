import uuid
from datetime import datetime

from sqlalchemy import Column, DateTime, ForeignKey, String, Text
from sqlalchemy.orm import DeclarativeBase, relationship


class Base(DeclarativeBase):
    pass


def gen_uuid() -> str:
    return str(uuid.uuid4())


class AgentRecord(Base):
    __tablename__ = "agents"

    id = Column(String, primary_key=True, default=gen_uuid)
    name = Column(String, nullable=False)
    role = Column(String, nullable=False)
    goal = Column(Text, nullable=False)
    system_prompt = Column(Text, nullable=False)
    agent_type = Column(String, nullable=False, default="worker")
    llm_model = Column(String, nullable=False, default="gpt-4o-mini")
    tools = Column(Text, nullable=False, default="[]")  # JSON array
    parent_agent_id = Column(String, ForeignKey("agents.id"), nullable=True)
    department = Column(String, nullable=False, default="general")
    status = Column(String, nullable=False, default="idle")
    email = Column(String, nullable=True, index=True)
    avatar_url = Column(String, nullable=True)
    workspace_provisioned = Column(String, nullable=False, default="none")  # none, google, microsoft
    slack_member_id = Column(String, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    children = relationship("AgentRecord", backref="parent", remote_side=[id])
    tasks = relationship("TaskRecord", back_populates="agent")


class TaskRecord(Base):
    __tablename__ = "tasks"

    id = Column(String, primary_key=True, default=gen_uuid)
    agent_id = Column(String, ForeignKey("agents.id"), nullable=True)
    directive = Column(Text, nullable=False)
    description = Column(Text, nullable=True, default="")
    status = Column(String, nullable=False, default="pending")
    board = Column(String, nullable=False, default="backlog")
    priority = Column(String, nullable=False, default="medium")
    labels = Column(Text, nullable=False, default="[]")
    due_date = Column(DateTime, nullable=True)
    result = Column(Text, nullable=True)
    parent_task_id = Column(String, ForeignKey("tasks.id"), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    agent = relationship("AgentRecord", back_populates="tasks")
    messages = relationship("MessageRecord", back_populates="task")
    subtasks = relationship("TaskRecord", backref="parent_task", remote_side=[id])


class LabelRecord(Base):
    __tablename__ = "labels"

    id = Column(String, primary_key=True, default=gen_uuid)
    name = Column(String, nullable=False, unique=True, index=True)
    color = Column(String, nullable=False, default="#6366f1")
    created_at = Column(DateTime, default=datetime.utcnow)


class ChatSessionRecord(Base):
    __tablename__ = "chat_sessions"

    id = Column(String, primary_key=True, default=gen_uuid)
    title = Column(String, nullable=False, default="New Chat")
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    messages = relationship("MessageRecord", back_populates="session")


class MessageRecord(Base):
    __tablename__ = "messages"

    id = Column(String, primary_key=True, default=gen_uuid)
    task_id = Column(String, ForeignKey("tasks.id"), nullable=True)
    session_id = Column(String, ForeignKey("chat_sessions.id"), nullable=True, index=True)
    role = Column(String, nullable=False)
    agent_id = Column(String, ForeignKey("agents.id"), nullable=True)
    content = Column(Text, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    task = relationship("TaskRecord", back_populates="messages")
    session = relationship("ChatSessionRecord", back_populates="messages")


class CredentialRecord(Base):
    __tablename__ = "credentials"

    id = Column(String, primary_key=True, default=gen_uuid)
    integration = Column(String, nullable=False, index=True)
    key = Column(String, nullable=False)
    value = Column(Text, nullable=False)
    agent_id = Column(String, ForeignKey("agents.id"), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class DepartmentRecord(Base):
    __tablename__ = "departments"

    id = Column(String, primary_key=True, default=gen_uuid)
    name = Column(String, nullable=False, unique=True, index=True)
    description = Column(Text, nullable=True, default="")
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class CompanySettingsRecord(Base):
    __tablename__ = "company_settings"

    key = Column(String, primary_key=True)
    value = Column(Text, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class UserRecord(Base):
    __tablename__ = "users"

    id = Column(String, primary_key=True, default=gen_uuid)
    email = Column(String, nullable=False, unique=True, index=True)
    name = Column(String, nullable=False)
    password_hash = Column(String, nullable=True)
    role = Column(String, nullable=False, default="viewer")
    avatar_url = Column(String, nullable=True)
    auth_provider = Column(String, nullable=True, default="email")
    status = Column(String, nullable=False, default="invited")
    invited_by = Column(String, ForeignKey("users.id"), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class UserOAuthConnectionRecord(Base):
    __tablename__ = "user_oauth_connections"

    id = Column(String, primary_key=True, default=gen_uuid)
    user_id = Column(String, ForeignKey("users.id"), nullable=False, index=True)
    provider = Column(String, nullable=False, index=True)
    external_email = Column(String, nullable=True)
    access_token = Column(Text, nullable=True)
    refresh_token = Column(Text, nullable=True)
    token_type = Column(String, nullable=True)
    scopes = Column(Text, nullable=True, default="")
    expires_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class BoardRecord(Base):
    __tablename__ = "boards"

    id = Column(String, primary_key=True, default=gen_uuid)
    name = Column(String, nullable=False, unique=True, index=True)
    created_at = Column(DateTime, default=datetime.utcnow)


class WaitlistRecord(Base):
    __tablename__ = "waitlist"

    id = Column(String, primary_key=True, default=gen_uuid)
    email = Column(String, nullable=False, unique=True, index=True)
    name = Column(String, nullable=True)
    source = Column(String, nullable=True, default="landing")
    created_at = Column(DateTime, default=datetime.utcnow)


class McpServerRecord(Base):
    __tablename__ = "mcp_servers"

    id = Column(String, primary_key=True, default=gen_uuid)
    name = Column(String, nullable=False)
    description = Column(Text, nullable=True, default="")
    icon = Column(String, nullable=False, default="Plug")
    connection_type = Column(String, nullable=False)  # "stdio" | "sse"
    command = Column(String, nullable=True)
    args = Column(Text, nullable=True, default="[]")
    env_vars = Column(Text, nullable=True, default="{}")
    url = Column(String, nullable=True)
    headers = Column(Text, nullable=True, default="{}")
    is_preset = Column(String, nullable=False, default="false")
    enabled = Column(String, nullable=False, default="true")
    discovered_tools = Column(Text, nullable=True, default="[]")
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
