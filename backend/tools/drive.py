from __future__ import annotations

import json
import io

from backend.tools.base import Tool, ToolRegistry
from backend.tools.google_auth import resolve_google_service


class UploadToDriveTool(Tool):
    name = "upload_to_drive"
    description = "Upload a text file to Google Drive. Returns the file ID and link."
    parameters = {
        "filename": {"type": "string", "description": "Name for the file in Drive"},
        "content": {"type": "string", "description": "Text content of the file"},
        "folder_id": {"type": "string", "description": "Optional Drive folder ID to upload into"},
        "mime_type": {"type": "string", "description": "MIME type (default text/plain)"},
    }

    async def execute(self, filename: str, content: str, folder_id: str = "", mime_type: str = "text/plain", **kwargs) -> str:
        agent_id = kwargs.get("_agent_id")
        try:
            service, _ = await resolve_google_service(
                api_name="drive",
                version="v3",
                integration="google_drive",
                agent_id=agent_id,
                delegated_scopes=[
                    "https://www.googleapis.com/auth/drive.file",
                    "https://www.googleapis.com/auth/drive.metadata.readonly",
                ],
            )
        except Exception as e:
            return json.dumps({"success": False, "error": str(e)})

        if service is None:
            return json.dumps({
                "success": False,
                "error": "Google Drive is not configured. Provision the agent in Google Workspace or add manual OAuth credentials in Settings > Integrations.",
            })

        try:
            from googleapiclient.http import MediaIoBaseUpload

            file_metadata: dict = {"name": filename}
            if folder_id:
                file_metadata["parents"] = [folder_id]

            media = MediaIoBaseUpload(
                io.BytesIO(content.encode("utf-8")),
                mimetype=mime_type,
                resumable=False,
            )
            file = service.files().create(
                body=file_metadata, media_body=media, fields="id, webViewLink"
            ).execute()

            return json.dumps({
                "success": True,
                "file_id": file["id"],
                "link": file.get("webViewLink", ""),
            })
        except Exception as e:
            return json.dumps({"success": False, "error": str(e)})


class ListDriveFilesTool(Tool):
    name = "list_drive_files"
    description = "List files in Google Drive, optionally filtered by query."
    parameters = {
        "query": {"type": "string", "description": "Drive search query (e.g. \"name contains 'report'\"). Leave empty for recent files."},
        "max_results": {"type": "integer", "description": "Maximum files to return (default 10)"},
    }

    async def execute(self, query: str = "", max_results: int = 10, **kwargs) -> str:
        agent_id = kwargs.get("_agent_id")
        try:
            service, _ = await resolve_google_service(
                api_name="drive",
                version="v3",
                integration="google_drive",
                agent_id=agent_id,
                delegated_scopes=[
                    "https://www.googleapis.com/auth/drive.metadata.readonly",
                ],
            )
        except Exception as e:
            return json.dumps({"success": False, "error": str(e)})

        if service is None:
            return json.dumps({
                "success": False,
                "error": "Google Drive is not configured. Provision the agent in Google Workspace or add manual OAuth credentials in Settings > Integrations.",
            })

        try:
            params: dict = {
                "pageSize": max_results,
                "fields": "files(id, name, mimeType, modifiedTime, webViewLink)",
                "orderBy": "modifiedTime desc",
            }
            if query:
                params["q"] = query

            result = service.files().list(**params).execute()
            files = [
                {
                    "id": f["id"],
                    "name": f["name"],
                    "mime_type": f.get("mimeType", ""),
                    "modified": f.get("modifiedTime", ""),
                    "link": f.get("webViewLink", ""),
                }
                for f in result.get("files", [])
            ]

            return json.dumps({"success": True, "files": files, "count": len(files)})
        except Exception as e:
            return json.dumps({"success": False, "error": str(e)})


ToolRegistry.register(UploadToDriveTool())
ToolRegistry.register(ListDriveFilesTool())
