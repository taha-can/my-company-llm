"""Bridge between the app and MCP servers via mcp-use library."""

from __future__ import annotations

import json
import logging
from typing import Any

from mcp_use import MCPClient

from backend.db.models import McpServerRecord

logger = logging.getLogger(__name__)


def build_mcp_config(server: McpServerRecord) -> dict:
    """Convert a DB record into the mcp-use config dict."""
    server_key = server.name.lower().replace(" ", "_")
    server_cfg: dict[str, Any] = {}

    if server.connection_type == "stdio":
        server_cfg["command"] = server.command or ""
        server_cfg["args"] = json.loads(server.args or "[]")
        env = json.loads(server.env_vars or "{}")
        if env:
            server_cfg["env"] = env
    else:
        server_cfg["url"] = server.url or ""
        headers = json.loads(server.headers or "{}")
        if headers:
            server_cfg["headers"] = headers

    return {"mcpServers": {server_key: server_cfg}}, server_key


async def discover_tools(server: McpServerRecord) -> list[dict]:
    """Connect to an MCP server and return its available tools."""
    config, server_key = build_mcp_config(server)
    client = MCPClient(config)

    try:
        await client.create_session(server_key)
        session = client.get_session(server_key)
        if not session:
            return []

        tools_result = await session.list_tools()
        tools = []
        for tool in tools_result:
            tools.append({
                "name": tool.name,
                "description": tool.description or "",
                "input_schema": tool.inputSchema if hasattr(tool, "inputSchema") else {},
            })
        return tools
    except Exception as e:
        logger.error("Failed to discover tools for MCP server %s: %s", server.name, e)
        raise
    finally:
        try:
            await client.close_all_sessions()
        except Exception:
            pass


async def call_mcp_tool(
    server: McpServerRecord,
    tool_name: str,
    arguments: dict[str, Any],
) -> str:
    """Connect to an MCP server, call a tool, and return the result as JSON string."""
    config, server_key = build_mcp_config(server)
    client = MCPClient(config)

    try:
        await client.create_session(server_key)
        session = client.get_session(server_key)
        if not session:
            return json.dumps({"error": f"Could not connect to MCP server: {server.name}"})

        result = await session.call_tool(tool_name, arguments)

        if hasattr(result, "content"):
            parts = []
            for block in result.content:
                if hasattr(block, "text"):
                    parts.append(block.text)
                else:
                    parts.append(str(block))
            return "\n".join(parts) if parts else json.dumps({"result": "ok"})

        return json.dumps({"result": str(result)})
    except Exception as e:
        logger.error("MCP tool call failed (%s/%s): %s", server.name, tool_name, e)
        return json.dumps({"error": f"MCP tool call failed: {str(e)}"})
    finally:
        try:
            await client.close_all_sessions()
        except Exception:
            pass


def mcp_tools_to_openai_functions(
    server: McpServerRecord,
) -> list[dict]:
    """Convert cached discovered tools into OpenAI function-call format with mcp__ prefix."""
    cached = json.loads(server.discovered_tools or "[]")
    server_key = server.name.lower().replace(" ", "_")
    functions = []

    for tool in cached:
        schema = tool.get("input_schema", {})
        properties = schema.get("properties", {})
        required = schema.get("required", [])

        functions.append({
            "type": "function",
            "function": {
                "name": f"mcp__{server_key}__{tool['name']}",
                "description": tool.get("description", ""),
                "parameters": {
                    "type": "object",
                    "properties": properties,
                    "required": required,
                },
            },
        })

    return functions


def parse_mcp_tool_name(fn_name: str) -> tuple[str, str] | None:
    """Parse 'mcp__<server_key>__<tool_name>' into (server_key, tool_name). Returns None if not MCP."""
    if not fn_name.startswith("mcp__"):
        return None
    parts = fn_name.split("__", 2)
    if len(parts) != 3:
        return None
    return parts[1], parts[2]
