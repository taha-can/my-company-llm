from __future__ import annotations

import json

from backend.engine.memory import AgentMemory, DepartmentKnowledgeBase, SharedKnowledgeBase
from backend.tools.base import Tool, ToolRegistry


class RAGSearchTool(Tool):
    name = "search_knowledge"
    description = (
        "Search the company knowledge base, department knowledge, and your own memory "
        "for relevant information. Use this to find facts about the company, department "
        "processes, products, brand guidelines, and past experiences."
    )
    parameters = {
        "query": {"type": "string", "description": "The search query"},
        "source": {
            "type": "string",
            "enum": ["all", "company", "department", "my_memory"],
            "description": "Where to search: company knowledge, department knowledge, your own memory, or all",
        },
    }

    def __init__(self):
        self._agent_memory: AgentMemory | None = None
        self._department: str | None = None

    def set_agent_memory(self, memory: AgentMemory):
        self._agent_memory = memory

    def set_department(self, department: str):
        self._department = department

    async def execute(self, query: str, source: str = "all", **kwargs) -> str:
        results = []

        if source in ("all", "company"):
            kb = SharedKnowledgeBase()
            company_results = kb.search(query, top_k=3)
            for r in company_results:
                results.append({"source": "company_knowledge", "text": r["text"], "priority": 1})

        if source in ("all", "department") and self._department:
            dept_kb = DepartmentKnowledgeBase(self._department)
            dept_results = dept_kb.search(query, top_k=3)
            for r in dept_results:
                results.append({"source": f"department_{self._department}", "text": r["text"], "priority": 2})

        if source in ("all", "my_memory") and self._agent_memory:
            episodic = self._agent_memory.search_episodic(query, top_k=3)
            for r in episodic:
                results.append({"source": "my_past_experience", "text": r["text"], "priority": 3})

            semantic = self._agent_memory.search_semantic(query, top_k=3)
            for r in semantic:
                results.append({"source": "my_knowledge", "text": r["text"], "priority": 4})

        if not results:
            return "No relevant information found."

        results.sort(key=lambda x: x.get("priority", 99))
        return json.dumps(results, indent=2)


ToolRegistry.register(RAGSearchTool())
