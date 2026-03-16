from __future__ import annotations

from pathlib import Path

from fastapi import APIRouter, File, Form, HTTPException, UploadFile
from fastapi.responses import FileResponse

from backend.engine.ingest import ingest_file

router = APIRouter()

MAX_FILE_SIZE = 50 * 1024 * 1024  # 50 MB
AVATAR_DIR = Path("./data/avatars")

ALLOWED_EXTENSIONS = {
    ".txt", ".md", ".log", ".json", ".xml", ".html", ".htm",
    ".pdf", ".docx", ".xlsx", ".xls", ".csv", ".tsv",
    ".png", ".jpg", ".jpeg", ".gif", ".webp", ".bmp", ".svg",
}


@router.get("/avatars/{filename}")
async def get_avatar(filename: str):
    filepath = AVATAR_DIR / filename
    if not filepath.exists() or not filepath.is_file():
        raise HTTPException(404, "Avatar not found")
    return FileResponse(filepath)


@router.post("/upload")
async def upload_file(
    file: UploadFile = File(...),
    agent_id: str | None = Form(None),
    department: str | None = Form(None),
    chunk_size: int = Form(800),
    chunk_overlap: int = Form(200),
):
    """Upload a file to be parsed, chunked, and stored in vector DB.
    
    Priority: agent_id > department > shared company knowledge.
    """
    if not file.filename:
        raise HTTPException(400, "No filename provided")

    ext = "." + file.filename.rsplit(".", 1)[-1].lower() if "." in file.filename else ""
    if ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(
            400,
            f"Unsupported file type: {ext}. Allowed: {', '.join(sorted(ALLOWED_EXTENSIONS))}",
        )

    content = await file.read()
    if len(content) > MAX_FILE_SIZE:
        raise HTTPException(400, f"File too large. Max size: {MAX_FILE_SIZE // (1024*1024)} MB")

    try:
        result = ingest_file(
            filename=file.filename,
            content=content,
            agent_id=agent_id if agent_id else None,
            department=department if department and not agent_id else None,
            chunk_size=chunk_size,
            chunk_overlap=chunk_overlap,
        )
    except Exception as e:
        raise HTTPException(500, f"Failed to process file: {str(e)}")

    return {
        "success": True,
        **result,
    }


@router.post("/upload/batch")
async def upload_files_batch(
    files: list[UploadFile] = File(...),
    agent_id: str | None = Form(None),
    department: str | None = Form(None),
    chunk_size: int = Form(800),
    chunk_overlap: int = Form(200),
):
    """Upload multiple files at once."""
    results = []

    for file in files:
        if not file.filename:
            continue

        ext = "." + file.filename.rsplit(".", 1)[-1].lower() if "." in file.filename else ""
        if ext not in ALLOWED_EXTENSIONS:
            results.append({"filename": file.filename, "success": False, "error": f"Unsupported: {ext}"})
            continue

        content = await file.read()
        if len(content) > MAX_FILE_SIZE:
            results.append({"filename": file.filename, "success": False, "error": "File too large"})
            continue

        try:
            result = ingest_file(
                filename=file.filename,
                content=content,
                agent_id=agent_id if agent_id else None,
                department=department if department and not agent_id else None,
                chunk_size=chunk_size,
                chunk_overlap=chunk_overlap,
            )
            results.append({"success": True, **result})
        except Exception as e:
            results.append({"filename": file.filename, "success": False, "error": str(e)})

    total_chunks = sum(r.get("chunks", 0) for r in results if r.get("success"))
    return {
        "files_processed": len(results),
        "total_chunks": total_chunks,
        "results": results,
    }
