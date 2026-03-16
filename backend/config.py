from pydantic_settings import BaseSettings
from pathlib import Path


class Settings(BaseSettings):
    # LLM keys stay in .env — they're needed at startup for embeddings/routing
    openai_api_key: str = ""
    anthropic_api_key: str = ""

    database_url: str = "sqlite+aiosqlite:///./data/fact.db"
    chromadb_path: str = "./data/memory"

    default_lead_model: str = "gpt-4o"
    default_worker_model: str = "gpt-4o-mini"
    default_creative_model: str = "anthropic/claude-sonnet-4-20250514"
    default_router_model: str = "gpt-4o-mini"
    embedding_model: str = "text-embedding-3-small"

    jwt_secret: str = "change-me-in-production"
    jwt_algorithm: str = "HS256"
    jwt_expire_minutes: int = 1440
    frontend_app_url: str = "http://localhost:3000"
    google_client_id: str = ""
    google_client_secret: str = ""

    model_config = {"env_file": ".env", "extra": "ignore"}

    @property
    def chromadb_abs_path(self) -> str:
        return str(Path(self.chromadb_path).resolve())


settings = Settings()
