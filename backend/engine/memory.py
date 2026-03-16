from __future__ import annotations

import json
from datetime import datetime
from pathlib import Path

import chromadb
from chromadb.utils.embedding_functions import OpenAIEmbeddingFunction

from backend.config import settings


_client: chromadb.ClientAPI | None = None


def _get_client() -> chromadb.ClientAPI:
    global _client
    if _client is None:
        path = Path(settings.chromadb_path).resolve()
        path.mkdir(parents=True, exist_ok=True)
        _client = chromadb.PersistentClient(path=str(path))
    return _client


def _get_embedding_fn() -> OpenAIEmbeddingFunction:
    return OpenAIEmbeddingFunction(
        api_key=settings.openai_api_key,
        model_name=settings.embedding_model,
    )


class AgentMemory:
    """Manages per-agent short-term and long-term memory via ChromaDB."""

    def __init__(self, agent_id: str):
        self.agent_id = agent_id
        self.client = _get_client()
        self.embedding_fn = _get_embedding_fn()

        self.episodic = self.client.get_or_create_collection(
            name=f"agent_{agent_id}_episodic",
            embedding_function=self.embedding_fn,
            metadata={"agent_id": agent_id, "type": "episodic"},
        )
        self.semantic = self.client.get_or_create_collection(
            name=f"agent_{agent_id}_semantic",
            embedding_function=self.embedding_fn,
            metadata={"agent_id": agent_id, "type": "semantic"},
        )

        self._working: list[dict] = []

    # ── Working memory (short-term, in-process) ───────────────

    def add_to_working(self, role: str, content: str):
        self._working.append({
            "role": role,
            "content": content,
            "timestamp": datetime.utcnow().isoformat(),
        })

    def get_working(self, last_n: int = 20) -> list[dict]:
        return self._working[-last_n:]

    def clear_working(self):
        self._working.clear()

    # ── Episodic memory (past task summaries) ─────────────────

    def store_episodic(self, summary: str, metadata: dict | None = None):
        import uuid
        doc_id = str(uuid.uuid4())
        meta = {
            "agent_id": self.agent_id,
            "timestamp": datetime.utcnow().isoformat(),
            **(metadata or {}),
        }
        self.episodic.add(
            documents=[summary],
            metadatas=[meta],
            ids=[doc_id],
        )

    def search_episodic(self, query: str, top_k: int = 5) -> list[dict]:
        if self.episodic.count() == 0:
            return []
        results = self.episodic.query(query_texts=[query], n_results=min(top_k, self.episodic.count()))
        return self._format_results(results)

    # ── Semantic memory (facts, knowledge, learnings) ─────────

    def store_semantic(self, text: str, metadata: dict | None = None):
        import uuid
        doc_id = str(uuid.uuid4())
        meta = {
            "agent_id": self.agent_id,
            "timestamp": datetime.utcnow().isoformat(),
            **(metadata or {}),
        }
        self.semantic.add(
            documents=[text],
            metadatas=[meta],
            ids=[doc_id],
        )

    def search_semantic(self, query: str, top_k: int = 5) -> list[dict]:
        if self.semantic.count() == 0:
            return []
        results = self.semantic.query(query_texts=[query], n_results=min(top_k, self.semantic.count()))
        return self._format_results(results)

    # ── Memory stats ──────────────────────────────────────────

    def stats(self) -> dict:
        return {
            "working_messages": len(self._working),
            "episodic_count": self.episodic.count(),
            "semantic_count": self.semantic.count(),
        }

    # ── Cleanup ───────────────────────────────────────────────

    def delete_all(self):
        self.client.delete_collection(f"agent_{self.agent_id}_episodic")
        self.client.delete_collection(f"agent_{self.agent_id}_semantic")
        self._working.clear()

    # ── Helpers ───────────────────────────────────────────────

    @staticmethod
    def _format_results(results: dict) -> list[dict]:
        docs = results.get("documents", [[]])[0]
        metas = results.get("metadatas", [[]])[0]
        distances = results.get("distances", [[]])[0]
        return [
            {"text": doc, "metadata": meta, "distance": dist}
            for doc, meta, dist in zip(docs, metas, distances)
        ]


class SharedKnowledgeBase:
    """Company-wide knowledge base accessible by all agents."""

    COLLECTION_NAME = "company_knowledge"

    def __init__(self):
        self.client = _get_client()
        self.embedding_fn = _get_embedding_fn()
        self.collection = self.client.get_or_create_collection(
            name=self.COLLECTION_NAME,
            embedding_function=self.embedding_fn,
            metadata={"type": "shared"},
        )

    def add(self, text: str, metadata: dict | None = None):
        import uuid
        doc_id = str(uuid.uuid4())
        meta = {
            "timestamp": datetime.utcnow().isoformat(),
            **(metadata or {}),
        }
        self.collection.add(documents=[text], metadatas=[meta], ids=[doc_id])

    def search(self, query: str, top_k: int = 5) -> list[dict]:
        if self.collection.count() == 0:
            return []
        results = self.collection.query(
            query_texts=[query],
            n_results=min(top_k, self.collection.count()),
        )
        return AgentMemory._format_results(results)

    def count(self) -> int:
        return self.collection.count()


def _sanitize_collection_name(raw: str) -> str:
    """Sanitize a string into a valid ChromaDB collection name.
    Allowed: [a-zA-Z0-9._-], must start/end with [a-zA-Z0-9], 3-512 chars."""
    import re
    import unicodedata
    normalized = unicodedata.normalize("NFKD", raw)
    ascii_str = normalized.encode("ascii", "ignore").decode("ascii")
    cleaned = re.sub(r"[^a-zA-Z0-9._-]", "_", ascii_str.lower())
    cleaned = re.sub(r"_+", "_", cleaned)
    cleaned = cleaned.strip("_.-")
    if not cleaned:
        cleaned = "default"
    if len(cleaned) < 3:
        cleaned = cleaned + "_col"
    return cleaned[:512]


class DepartmentKnowledgeBase:
    """Per-department knowledge base shared among all agents in a department."""

    def __init__(self, department: str):
        self.department = department
        self.client = _get_client()
        self.embedding_fn = _get_embedding_fn()
        collection_name = f"dept_{_sanitize_collection_name(department)}_knowledge"
        self.collection = self.client.get_or_create_collection(
            name=collection_name,
            embedding_function=self.embedding_fn,
            metadata={"type": "department", "department": department},
        )

    def add(self, text: str, metadata: dict | None = None):
        import uuid
        doc_id = str(uuid.uuid4())
        meta = {
            "department": self.department,
            "timestamp": datetime.utcnow().isoformat(),
            **(metadata or {}),
        }
        self.collection.add(documents=[text], metadatas=[meta], ids=[doc_id])

    def search(self, query: str, top_k: int = 5) -> list[dict]:
        if self.collection.count() == 0:
            return []
        results = self.collection.query(
            query_texts=[query],
            n_results=min(top_k, self.collection.count()),
        )
        return AgentMemory._format_results(results)

    def count(self) -> int:
        return self.collection.count()
