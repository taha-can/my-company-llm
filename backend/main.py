import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from backend.db.database import init_db
from backend.api.agents import router as agents_router
from backend.api.tasks import router as tasks_router
from backend.api.chat import router as chat_router
from backend.api.files import router as files_router
from backend.api.credentials import router as credentials_router
from backend.api.company import router as company_router
from backend.api.departments import router as departments_router
from backend.api.users import router as users_router
from backend.api.auth import router as auth_router
from backend.api.calendar import router as calendar_router
from backend.api.waitlist import router as waitlist_router
from backend.api.models import router as models_router
from backend.api.mcp_servers import router as mcp_router

logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    await init_db()
    yield


app = FastAPI(title="my-company-llm", version="0.1.0-beta", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    logger.exception("Unhandled error on %s %s", request.method, request.url.path)
    return JSONResponse(
        status_code=500,
        content={"detail": "Internal server error"},
    )

app.include_router(agents_router, prefix="/api/agents", tags=["agents"])
app.include_router(tasks_router, prefix="/api/tasks", tags=["tasks"])
app.include_router(files_router, prefix="/api/files", tags=["files"])
app.include_router(credentials_router, prefix="/api/credentials", tags=["credentials"])
app.include_router(company_router, prefix="/api/company", tags=["company"])
app.include_router(departments_router, prefix="/api/departments", tags=["departments"])
app.include_router(users_router, prefix="/api/users", tags=["users"])
app.include_router(auth_router, prefix="/api/auth", tags=["auth"])
app.include_router(calendar_router, prefix="/api/calendar", tags=["calendar"])
app.include_router(waitlist_router, prefix="/api/waitlist", tags=["waitlist"])
app.include_router(models_router, prefix="/api/models", tags=["models"])
app.include_router(chat_router, prefix="/ws", tags=["chat"])
app.include_router(mcp_router, prefix="/api/mcp-servers", tags=["mcp"])


@app.get("/api/health")
async def health():
    return {"status": "ok", "version": app.version}


@app.get("/api/health/llm")
async def llm_health():
    from backend.config import settings
    providers = {}

    if settings.openai_api_key and settings.openai_api_key != "sk-...":
        try:
            import httpx
            async with httpx.AsyncClient(timeout=5) as client:
                r = await client.get(
                    "https://api.openai.com/v1/models",
                    headers={"Authorization": f"Bearer {settings.openai_api_key}"},
                )
                providers["openai"] = {"configured": True, "active": r.status_code == 200}
        except Exception:
            providers["openai"] = {"configured": True, "active": False}
    else:
        providers["openai"] = {"configured": False, "active": False}

    if settings.anthropic_api_key and settings.anthropic_api_key != "sk-ant-...":
        try:
            import httpx
            async with httpx.AsyncClient(timeout=5) as client:
                r = await client.get(
                    "https://api.anthropic.com/v1/models",
                    headers={
                        "x-api-key": settings.anthropic_api_key,
                        "anthropic-version": "2023-06-01",
                    },
                )
                providers["anthropic"] = {"configured": True, "active": r.status_code == 200}
        except Exception:
            providers["anthropic"] = {"configured": True, "active": False}
    else:
        providers["anthropic"] = {"configured": False, "active": False}

    any_active = any(p["active"] for p in providers.values())
    any_configured = any(p["configured"] for p in providers.values())

    return {"providers": providers, "any_active": any_active, "any_configured": any_configured}
