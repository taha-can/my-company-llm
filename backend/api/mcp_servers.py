"""MCP Servers API: CRUD, preset catalog, tool discovery, and connection testing."""

from __future__ import annotations

import json
import logging

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from backend.db.database import get_session
from backend.db.models import McpServerRecord
from backend.engine.mcp_bridge import discover_tools

router = APIRouter()
logger = logging.getLogger(__name__)


# ── Schemas ───────────────────────────────────────────

class McpServerCreate(BaseModel):
    name: str
    description: str = ""
    icon: str = "Plug"
    connection_type: str  # "stdio" | "sse"
    command: str | None = None
    args: list[str] | None = None
    env_vars: dict[str, str] | None = None
    url: str | None = None
    headers: dict[str, str] | None = None
    is_preset: bool = False


class McpServerUpdate(BaseModel):
    name: str | None = None
    description: str | None = None
    icon: str | None = None
    connection_type: str | None = None
    command: str | None = None
    args: list[str] | None = None
    env_vars: dict[str, str] | None = None
    url: str | None = None
    headers: dict[str, str] | None = None
    enabled: bool | None = None


class McpServerOut(BaseModel):
    id: str
    name: str
    description: str
    icon: str
    connection_type: str
    command: str | None
    args: list[str]
    env_vars: dict[str, str]
    url: str | None
    headers: dict[str, str]
    is_preset: bool
    enabled: bool
    discovered_tools: list[dict]
    created_at: str


class McpPresetOut(BaseModel):
    id: str
    name: str
    description: str
    icon: str
    connection_type: str
    command: str | None = None
    args: list[str] = []
    env_keys: list[str] = []


# ── Preset Catalog ────────────────────────────────────

PRESETS: list[dict] = [
    {
        "id": "playwright",
        "name": "Playwright Browser",
        "description": "Browser automation — navigate, click, fill forms, take screenshots",
        "icon": "Globe",
        "connection_type": "stdio",
        "command": "npx",
        "args": ["@playwright/mcp@latest"],
        "env_keys": [],
    },
    {
        "id": "filesystem",
        "name": "Filesystem",
        "description": "Read, write, and manage files on the local filesystem",
        "icon": "HardDrive",
        "connection_type": "stdio",
        "command": "npx",
        "args": ["-y", "@modelcontextprotocol/server-filesystem", "/tmp"],
        "env_keys": [],
    },
    {
        "id": "github",
        "name": "GitHub",
        "description": "Manage GitHub repos, issues, pull requests, and code search",
        "icon": "Github",
        "connection_type": "stdio",
        "command": "npx",
        "args": ["-y", "@modelcontextprotocol/server-github"],
        "env_keys": ["GITHUB_PERSONAL_ACCESS_TOKEN"],
    },
    {
        "id": "postgres",
        "name": "PostgreSQL",
        "description": "Query and manage PostgreSQL databases",
        "icon": "Database",
        "connection_type": "stdio",
        "command": "npx",
        "args": ["-y", "@modelcontextprotocol/server-postgres"],
        "env_keys": ["POSTGRES_CONNECTION_STRING"],
    },
    {
        "id": "brave_search",
        "name": "Brave Search",
        "description": "Web and local search powered by Brave Search API",
        "icon": "Search",
        "connection_type": "stdio",
        "command": "npx",
        "args": ["-y", "@modelcontextprotocol/server-brave-search"],
        "env_keys": ["BRAVE_API_KEY"],
    },
    {
        "id": "slack_mcp",
        "name": "Slack",
        "description": "Send messages, manage channels, and interact with Slack workspaces",
        "icon": "MessageSquare",
        "connection_type": "stdio",
        "command": "npx",
        "args": ["-y", "@modelcontextprotocol/server-slack"],
        "env_keys": ["SLACK_BOT_TOKEN", "SLACK_TEAM_ID"],
    },
]


def _record_to_out(record: McpServerRecord) -> McpServerOut:
    return McpServerOut(
        id=record.id,
        name=record.name,
        description=record.description or "",
        icon=record.icon,
        connection_type=record.connection_type,
        command=record.command,
        args=json.loads(record.args or "[]"),
        env_vars=json.loads(record.env_vars or "{}"),
        url=record.url,
        headers=json.loads(record.headers or "{}"),
        is_preset=record.is_preset == "true",
        enabled=record.enabled == "true",
        discovered_tools=json.loads(record.discovered_tools or "[]"),
        created_at=record.created_at.isoformat() if record.created_at else "",
    )


# ── Endpoints ─────────────────────────────────────────

@router.get("")
async def list_servers(session: AsyncSession = Depends(get_session)) -> list[McpServerOut]:
    result = await session.execute(select(McpServerRecord).order_by(McpServerRecord.created_at))
    return [_record_to_out(r) for r in result.scalars().all()]


@router.get("/presets")
async def list_presets() -> list[McpPresetOut]:
    return [McpPresetOut(**p) for p in PRESETS]


@router.post("")
async def create_server(
    body: McpServerCreate,
    session: AsyncSession = Depends(get_session),
) -> McpServerOut:
    record = McpServerRecord(
        name=body.name,
        description=body.description,
        icon=body.icon,
        connection_type=body.connection_type,
        command=body.command,
        args=json.dumps(body.args or []),
        env_vars=json.dumps(body.env_vars or {}),
        url=body.url,
        headers=json.dumps(body.headers or {}),
        is_preset="true" if body.is_preset else "false",
        enabled="true",
        discovered_tools="[]",
    )
    session.add(record)
    await session.commit()
    await session.refresh(record)
    return _record_to_out(record)


@router.put("/{server_id}")
async def update_server(
    server_id: str,
    body: McpServerUpdate,
    session: AsyncSession = Depends(get_session),
) -> McpServerOut:
    result = await session.execute(
        select(McpServerRecord).where(McpServerRecord.id == server_id)
    )
    record = result.scalar_one_or_none()
    if not record:
        raise HTTPException(404, "MCP server not found")

    if body.name is not None:
        record.name = body.name
    if body.description is not None:
        record.description = body.description
    if body.icon is not None:
        record.icon = body.icon
    if body.connection_type is not None:
        record.connection_type = body.connection_type
    if body.command is not None:
        record.command = body.command
    if body.args is not None:
        record.args = json.dumps(body.args)
    if body.env_vars is not None:
        record.env_vars = json.dumps(body.env_vars)
    if body.url is not None:
        record.url = body.url
    if body.headers is not None:
        record.headers = json.dumps(body.headers)
    if body.enabled is not None:
        record.enabled = "true" if body.enabled else "false"

    await session.commit()
    await session.refresh(record)
    return _record_to_out(record)


@router.delete("/{server_id}")
async def delete_server(
    server_id: str,
    session: AsyncSession = Depends(get_session),
):
    result = await session.execute(
        select(McpServerRecord).where(McpServerRecord.id == server_id)
    )
    record = result.scalar_one_or_none()
    if not record:
        raise HTTPException(404, "MCP server not found")

    await session.delete(record)
    await session.commit()
    return {"success": True, "deleted": server_id}


@router.post("/{server_id}/discover")
async def discover_server_tools(
    server_id: str,
    session: AsyncSession = Depends(get_session),
):
    """Connect to the MCP server, discover available tools, and cache the result."""
    result = await session.execute(
        select(McpServerRecord).where(McpServerRecord.id == server_id)
    )
    record = result.scalar_one_or_none()
    if not record:
        raise HTTPException(404, "MCP server not found")

    try:
        tools = await discover_tools(record)
        record.discovered_tools = json.dumps(tools)
        await session.commit()
        return {"success": True, "tools": tools}
    except Exception as e:
        raise HTTPException(502, f"Failed to discover tools: {str(e)}")


@router.post("/{server_id}/test")
async def test_connection(
    server_id: str,
    session: AsyncSession = Depends(get_session),
):
    """Test connectivity to an MCP server."""
    result = await session.execute(
        select(McpServerRecord).where(McpServerRecord.id == server_id)
    )
    record = result.scalar_one_or_none()
    if not record:
        raise HTTPException(404, "MCP server not found")

    try:
        tools = await discover_tools(record)
        return {"success": True, "message": f"Connected. Found {len(tools)} tools."}
    except Exception as e:
        return {"success": False, "message": str(e)}
