"""Delete tasks from the database.

Usage:
    python -m backend.delete_tasks                          # interactive: lists tasks and asks for confirmation
    python -m backend.delete_tasks --all                    # delete ALL tasks
    python -m backend.delete_tasks --id <task_id>           # delete a single task by ID
    python -m backend.delete_tasks --status completed       # delete tasks with a given status
    python -m backend.delete_tasks --board done             # delete tasks on a given board
    python -m backend.delete_tasks --status failed --dry-run  # preview without deleting
"""

import argparse
import asyncio
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from sqlalchemy import delete, func, select  # noqa: E402

from backend.db.database import async_session, init_db  # noqa: E402
from backend.db.models import MessageRecord, TaskRecord  # noqa: E402


async def count_tasks(session, stmt):
    result = await session.execute(select(func.count()).select_from(stmt.subquery()))
    return result.scalar() or 0


async def preview_tasks(session, stmt, limit=20):
    result = await session.execute(stmt.limit(limit))
    rows = result.scalars().all()
    for t in rows:
        print(f"  [{t.status:<20}] [{t.board:<12}] {t.id}  {t.directive[:80]}")
    return rows


async def delete_related_messages(session, task_ids: list[str]):
    if not task_ids:
        return 0
    result = await session.execute(
        delete(MessageRecord).where(MessageRecord.task_id.in_(task_ids))
    )
    return result.rowcount


async def delete_matching_tasks(session, stmt):
    id_query = stmt.with_only_columns(TaskRecord.id)
    task_ids_result = await session.execute(id_query)
    task_ids = [row[0] for row in task_ids_result.all()]

    if not task_ids:
        return 0, 0, 0

    msgs_deleted = await delete_related_messages(session, task_ids)

    subtasks_result = await session.execute(
        delete(TaskRecord).where(TaskRecord.parent_task_id.in_(task_ids))
    )
    subtasks_deleted = subtasks_result.rowcount

    result = await session.execute(delete(TaskRecord).where(TaskRecord.id.in_(task_ids)))
    return result.rowcount, subtasks_deleted, msgs_deleted


def build_query(args):
    stmt = select(TaskRecord)

    if args.id:
        stmt = stmt.where(TaskRecord.id == args.id)
    if args.status:
        stmt = stmt.where(TaskRecord.status == args.status)
    if args.board:
        stmt = stmt.where(TaskRecord.board == args.board)

    return stmt


async def run(args):
    await init_db()

    async with async_session() as session:
        stmt = build_query(args)
        total = await count_tasks(session, stmt)

        if total == 0:
            print("No tasks match the given criteria.")
            return

        print(f"\n  Found {total} task(s) matching criteria:\n")
        await preview_tasks(session, stmt)
        if total > 20:
            print(f"  ... and {total - 20} more")

        if args.dry_run:
            print("\n  [DRY RUN] No tasks were deleted.")
            return

        if not args.yes:
            answer = input(f"\n  Delete {total} task(s) and their messages/subtasks? [y/N] ").strip().lower()
            if answer not in ("y", "yes"):
                print("  Aborted.")
                return

        deleted, subs, msgs = await delete_matching_tasks(session, stmt)
        await session.commit()
        print(f"\n  Deleted {deleted} task(s), {subs} subtask(s), {msgs} message(s).")


def main():
    parser = argparse.ArgumentParser(description="Delete tasks from the database")
    parser.add_argument("--all", action="store_true", help="Delete ALL tasks")
    parser.add_argument("--id", type=str, help="Delete a specific task by ID")
    parser.add_argument("--status", type=str, help="Delete tasks with this status (e.g. completed, failed, pending)")
    parser.add_argument("--board", type=str, help="Delete tasks on this board (e.g. done, backlog, in_progress)")
    parser.add_argument("--dry-run", action="store_true", help="Preview what would be deleted without actually deleting")
    parser.add_argument("-y", "--yes", action="store_true", help="Skip confirmation prompt")
    args = parser.parse_args()

    if not (args.all or args.id or args.status or args.board):
        parser.print_help()
        print("\nError: Specify at least one of --all, --id, --status, or --board.")
        sys.exit(1)

    asyncio.run(run(args))


if __name__ == "__main__":
    main()
