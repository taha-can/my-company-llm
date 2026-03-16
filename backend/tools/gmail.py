from __future__ import annotations

import json
import base64
from email.mime.text import MIMEText

from backend.tools.base import Tool, ToolRegistry
from backend.tools.google_auth import resolve_google_service


async def _resolve_gmail_service(
    agent_id: str | None,
    explicit_sender_email: str | None = None,
):
    """Resolve the best available Gmail service for the given agent.

    Priority:
      1. Agent has sender_email -> use domain-wide delegation via service account
      2. Fall back to global/agent-specific OAuth refresh token
    """
    return await resolve_google_service(
        api_name="gmail",
        version="v1",
        integration="google_gmail",
        agent_id=agent_id,
        delegated_scopes=[
            "https://www.googleapis.com/auth/gmail.send",
            "https://www.googleapis.com/auth/gmail.readonly",
        ],
        explicit_sender_email=explicit_sender_email,
    )


class SendEmailTool(Tool):
    name = "send_email"
    description = "Send an email via Gmail. Returns the sent message ID on success."
    parameters = {
        "to": {"type": "string", "description": "Recipient email address"},
        "subject": {"type": "string", "description": "Email subject line"},
        "body": {"type": "string", "description": "Plain-text email body"},
    }

    async def execute(self, to: str, subject: str, body: str, **kwargs) -> str:
        agent_id = kwargs.get("_agent_id")

        try:
            service, sender_email = await _resolve_gmail_service(agent_id)
        except Exception as e:
            return json.dumps({"success": False, "error": str(e)})

        if service is None:
            return json.dumps({
                "success": False,
                "error": "Gmail is not configured. Provision the agent in Google Workspace or add manual OAuth credentials in Settings > Integrations.",
            })

        try:
            message = MIMEText(body)
            message["to"] = to
            message["subject"] = subject
            if sender_email:
                message["from"] = sender_email
            raw = base64.urlsafe_b64encode(message.as_bytes()).decode()
            result = service.users().messages().send(
                userId="me", body={"raw": raw}
            ).execute()
            return json.dumps({"success": True, "message_id": result["id"]})
        except Exception as e:
            return json.dumps({"success": False, "error": str(e)})


class ReadEmailTool(Tool):
    name = "read_email"
    description = "Search and read emails from Gmail inbox."
    parameters = {
        "query": {"type": "string", "description": "Gmail search query (e.g. 'from:user@example.com is:unread')"},
        "max_results": {"type": "integer", "description": "Maximum number of emails to return (default 5)"},
    }

    async def execute(self, query: str = "", max_results: int = 5, **kwargs) -> str:
        agent_id = kwargs.get("_agent_id")

        try:
            service, _ = await _resolve_gmail_service(agent_id)
        except Exception as e:
            return json.dumps({"success": False, "error": str(e)})

        if service is None:
            return json.dumps({
                "success": False,
                "error": "Gmail is not configured. Provision the agent in Google Workspace or add manual OAuth credentials in Settings > Integrations.",
            })

        try:
            results = service.users().messages().list(
                userId="me", q=query, maxResults=max_results
            ).execute()

            messages = results.get("messages", [])
            emails = []
            for msg_ref in messages:
                msg = service.users().messages().get(
                    userId="me", id=msg_ref["id"], format="metadata",
                    metadataHeaders=["From", "Subject", "Date"],
                ).execute()
                headers = {h["name"]: h["value"] for h in msg.get("payload", {}).get("headers", [])}
                emails.append({
                    "id": msg["id"],
                    "from": headers.get("From", ""),
                    "subject": headers.get("Subject", ""),
                    "date": headers.get("Date", ""),
                    "snippet": msg.get("snippet", ""),
                })

            return json.dumps({"success": True, "emails": emails, "count": len(emails)})
        except Exception as e:
            return json.dumps({"success": False, "error": str(e)})


ToolRegistry.register(SendEmailTool())
ToolRegistry.register(ReadEmailTool())
