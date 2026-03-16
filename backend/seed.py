"""Seed the database – placeholder.

Default agents are no longer pre-created.
Users create their own departments and agents during onboarding.
"""

import asyncio
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from backend.db.database import init_db  # noqa: E402


async def seed():
    await init_db()
    print("Database initialised. No default agents — users create them during onboarding.")


if __name__ == "__main__":
    asyncio.run(seed())
