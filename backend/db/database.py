from pathlib import Path

from sqlalchemy import inspect, text
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from backend.config import settings
from backend.db.models import Base

Path("data").mkdir(exist_ok=True)

engine = create_async_engine(settings.database_url, echo=False)
async_session = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)


def _add_missing_columns(connection):
    """Add columns defined in models but missing from existing tables."""
    inspector = inspect(connection)
    for table in Base.metadata.sorted_tables:
        if not inspector.has_table(table.name):
            continue
        existing = {col["name"] for col in inspector.get_columns(table.name)}
        for col in table.columns:
            if col.name not in existing:
                col_type = col.type.compile(connection.dialect)
                default = ""
                if col.default is not None:
                    default = f" DEFAULT {col.default.arg!r}"
                connection.execute(
                    text(f"ALTER TABLE {table.name} ADD COLUMN {col.name} {col_type}{default}")
                )


async def init_db():
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
        await conn.run_sync(_add_missing_columns)


async def get_session() -> AsyncSession:
    async with async_session() as session:
        yield session
