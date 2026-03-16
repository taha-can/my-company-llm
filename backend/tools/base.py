from __future__ import annotations

from abc import ABC, abstractmethod
from typing import Any

DEFAULT_AGENT_TOOLS = [
    "create_project_task",
    "send_email",
]


class Tool(ABC):
    name: str
    description: str
    parameters: dict[str, Any]
    required: list[str] | None = None

    @abstractmethod
    async def execute(self, **kwargs) -> str:
        ...

    def to_openai_function(self) -> dict:
        required = self.required if self.required is not None else list(self.parameters.keys())
        return {
            "type": "function",
            "function": {
                "name": self.name,
                "description": self.description,
                "parameters": {
                    "type": "object",
                    "properties": self.parameters,
                    "required": required,
                },
            },
        }


class ToolRegistry:
    _tools: dict[str, Tool] = {}

    @classmethod
    def register(cls, tool: Tool):
        cls._tools[tool.name] = tool

    @classmethod
    def get(cls, name: str) -> Tool | None:
        return cls._tools.get(name)

    @classmethod
    def get_many(cls, names: list[str]) -> list[Tool]:
        return [cls._tools[n] for n in names if n in cls._tools]

    @classmethod
    def all_names(cls) -> list[str]:
        return list(cls._tools.keys())

    @classmethod
    def as_openai_functions(cls, names: list[str]) -> list[dict]:
        return [t.to_openai_function() for t in cls.get_many(names)]


def merge_with_default_tools(names: list[str] | None) -> list[str]:
    merged: list[str] = []
    for name in [*(names or []), *DEFAULT_AGENT_TOOLS]:
        if name not in merged:
            merged.append(name)
    return merged
