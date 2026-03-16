"""Workspace provisioning service for AI agents.

Handles:
- Google Workspace account creation via Admin SDK
- Microsoft 365 account creation via Graph API
- Slack workspace invitation
- AI avatar generation
"""

from __future__ import annotations

import hashlib
import json
import logging
import os
import re
import unicodedata
from base64 import b64decode
from pathlib import Path

import httpx
from sqlalchemy.ext.asyncio import AsyncSession

from backend.engine.credentials import get_credentials

logger = logging.getLogger(__name__)

AVATAR_DIR = Path("./data/avatars")
AVATAR_DIR.mkdir(parents=True, exist_ok=True)


async def provision_workspace_account(
    *,
    provider: str,
    email: str,
    name: str,
    department: str,
    role: str,
    session: AsyncSession,
) -> dict:
    if provider == "google":
        return await _provision_google_workspace(email, name, department, role)
    elif provider == "microsoft":
        return await _provision_microsoft_365(email, name, department, role)
    else:
        return {"status": "error", "reason": f"Unknown provider: {provider}"}


async def _provision_google_workspace(
    email: str, name: str, department: str, role: str
) -> dict:
    """Create a Google Workspace account via Admin SDK."""
    creds = await get_credentials("google_workspace_admin")

    if not creds.get("service_account_json") or not creds.get("admin_email"):
        return {
            "status": "pending",
            "reason": "Google Workspace Admin credentials not configured. "
                      "Add service account JSON and admin email in Settings > Integrations.",
            "email": email,
        }

    try:
        from google.oauth2 import service_account
        from googleapiclient.discovery import build

        sa_info = json.loads(creds["service_account_json"])
        credentials = service_account.Credentials.from_service_account_info(
            sa_info,
            scopes=[
                "https://www.googleapis.com/auth/admin.directory.user",
                "https://www.googleapis.com/auth/admin.directory.orgunit",
            ],
            subject=creds["admin_email"],
        )

        service = build("admin", "directory_v1", credentials=credentials)
        org_unit_path = _build_google_org_unit_path(department)
        _ensure_google_org_unit(service, org_unit_path)

        parts = name.split(" ", 1)
        first_name = parts[0]
        last_name = parts[1] if len(parts) > 1 else ""

        temp_password = hashlib.sha256(f"{email}-agent".encode()).hexdigest()[:16] + "A1!"

        user_body = {
            "primaryEmail": email,
            "name": {"givenName": first_name, "familyName": last_name},
            "password": temp_password,
            "orgUnitPath": org_unit_path,
            "organizations": [{"title": role, "department": department, "primary": True}],
            "isMailboxSetup": True,
        }

        service.users().insert(body=user_body).execute()

        return {
            "status": "provisioned",
            "email": email,
            "provider": "google",
            "org_unit_path": org_unit_path,
        }

    except ImportError:
        return {
            "status": "pending",
            "reason": "Google API client libraries not installed. "
                      "Install google-api-python-client and google-auth.",
            "email": email,
        }
    except Exception as e:
        logger.error(f"Google Workspace provisioning failed: {e}")
        return {
            "status": "error",
            "reason": str(e),
            "email": email,
        }


def _build_google_org_unit_path(department: str) -> str:
    """Convert a free-form department name into a valid Google Org Unit path."""
    if not department or not department.strip():
        return "/"

    normalized = unicodedata.normalize("NFKD", department).encode("ascii", "ignore").decode("ascii")
    normalized = normalized.lower().replace("&", " and ")
    normalized = re.sub(r"[^a-z0-9]+", "-", normalized)
    normalized = re.sub(r"-{2,}", "-", normalized).strip("-")
    return f"/{normalized or 'general'}"


def _ensure_google_org_unit(service, org_unit_path: str) -> str:
    """Create the requested Google Workspace Org Unit if it does not already exist."""
    from googleapiclient.errors import HttpError

    if org_unit_path == "/":
        return org_unit_path

    current_path = "/"
    for segment in org_unit_path.strip("/").split("/"):
        next_path = f"{current_path.rstrip('/')}/{segment}" if current_path != "/" else f"/{segment}"
        lookup_path = next_path.lstrip("/")
        try:
            service.orgunits().get(customerId="my_customer", orgUnitPath=lookup_path).execute()
        except HttpError as exc:
            status = getattr(getattr(exc, "resp", None), "status", None)
            if status != 404:
                raise
            body = {
                "name": segment,
                "parentOrgUnitPath": current_path,
            }
            service.orgunits().insert(customerId="my_customer", body=body).execute()
        current_path = next_path

    return current_path


async def _provision_microsoft_365(
    email: str, name: str, department: str, role: str
) -> dict:
    """Create a Microsoft 365 account via Graph API."""
    creds = await get_credentials("microsoft_365_admin")

    if not creds.get("tenant_id") or not creds.get("client_id") or not creds.get("client_secret"):
        return {
            "status": "pending",
            "reason": "Microsoft 365 Admin credentials not configured. "
                      "Add tenant ID, client ID, and client secret in Settings > Integrations.",
            "email": email,
        }

    try:
        async with httpx.AsyncClient() as client:
            token_url = f"https://login.microsoftonline.com/{creds['tenant_id']}/oauth2/v2.0/token"
            token_resp = await client.post(token_url, data={
                "client_id": creds["client_id"],
                "client_secret": creds["client_secret"],
                "scope": "https://graph.microsoft.com/.default",
                "grant_type": "client_credentials",
            })
            token_data = token_resp.json()
            access_token = token_data.get("access_token")

            if not access_token:
                return {"status": "error", "reason": "Failed to get M365 access token", "email": email}

            parts = name.split(" ", 1)
            first_name = parts[0]
            last_name = parts[1] if len(parts) > 1 else ""
            mail_nickname = email.split("@")[0].replace(".", "")

            user_body = {
                "accountEnabled": True,
                "displayName": name,
                "givenName": first_name,
                "surname": last_name,
                "mailNickname": mail_nickname,
                "userPrincipalName": email,
                "department": department,
                "jobTitle": role,
                "passwordProfile": {
                    "forceChangePasswordNextSignIn": False,
                    "password": hashlib.sha256(f"{email}-agent".encode()).hexdigest()[:16] + "A1!",
                },
            }

            resp = await client.post(
                "https://graph.microsoft.com/v1.0/users",
                headers={"Authorization": f"Bearer {access_token}", "Content-Type": "application/json"},
                json=user_body,
            )

            if resp.status_code in (200, 201):
                return {"status": "provisioned", "email": email, "provider": "microsoft"}
            else:
                return {"status": "error", "reason": resp.text, "email": email}

    except Exception as e:
        logger.error(f"Microsoft 365 provisioning failed: {e}")
        return {"status": "error", "reason": str(e), "email": email}


async def provision_slack_account(
    *, email: str, name: str, session: AsyncSession
) -> dict:
    """Invite the agent to Slack workspace using Admin API."""
    creds = await get_credentials("slack")

    if not creds.get("bot_token"):
        return {
            "status": "pending",
            "reason": "Slack bot token not configured. Add it in Settings > Integrations.",
        }

    if not email:
        return {"status": "skipped", "reason": "No email address for this agent"}

    try:
        async with httpx.AsyncClient() as client:
            resp = await client.post(
                "https://slack.com/api/admin.users.invite",
                headers={"Authorization": f"Bearer {creds['bot_token']}"},
                json={
                    "email": email,
                    "channel_ids": creds.get("default_channel", ""),
                    "team_id": creds.get("team_id", ""),
                    "real_name": name,
                    "is_bot": False,
                },
            )
            data = resp.json()

            if data.get("ok"):
                return {
                    "status": "invited",
                    "member_id": data.get("user", {}).get("id"),
                    "email": email,
                }
            else:
                return {
                    "status": "error",
                    "reason": data.get("error", "Unknown Slack error"),
                    "email": email,
                }

    except Exception as e:
        logger.error(f"Slack provisioning failed: {e}")
        return {"status": "error", "reason": str(e)}


async def generate_agent_avatar(
    *, name: str, role: str, department: str
) -> dict:
    """Generate a professional avatar for the agent using Gemini image generation."""
    creds = await get_credentials("gemini")

    if not creds.get("api_key"):
        initials = "".join(w[0].upper() for w in name.split()[:2])
        return {
            "status": "fallback",
            "avatar_url": f"/api/agents/avatar/initials/{initials}",
            "reason": "Gemini API key not configured, using initials avatar.",
        }

    try:
        prompt = (
            f"Professional corporate headshot portrait of a friendly AI assistant named {name}, "
            f"working as {role} in the {department} department. "
            f"Modern, clean, professional appearance. Photorealistic style. "
            f"Neutral background. Warm, approachable expression. "
            f"Corporate profile photo framing. High quality portrait."
        )

        async with httpx.AsyncClient() as http_client:
            resp = await http_client.post(
                "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-image:generateContent",
                headers={
                    "x-goog-api-key": creds["api_key"],
                    "Content-Type": "application/json",
                },
                json={
                    "contents": [
                        {
                            "parts": [
                                {"text": prompt},
                            ]
                        }
                    ],
                    "generationConfig": {
                        "responseModalities": ["TEXT", "IMAGE"],
                    },
                },
                timeout=120,
            )
            resp.raise_for_status()
            data = resp.json()

        image_part = None
        for candidate in data.get("candidates", []):
            for part in candidate.get("content", {}).get("parts", []):
                inline_data = part.get("inlineData") or part.get("inline_data")
                if inline_data and inline_data.get("data"):
                    image_part = inline_data
                    break
            if image_part:
                break

        if not image_part:
            raise ValueError("Gemini returned no image data for the avatar request.")

        mime_type = image_part.get("mimeType") or image_part.get("mime_type") or "image/png"
        extension = ".png" if "png" in mime_type else ".jpg"
        safe_name = re.sub(r"[^a-z0-9]+", "_", name.lower()).strip("_") or "agent"
        filename = f"{safe_name}_{hashlib.md5(name.encode()).hexdigest()[:8]}{extension}"
        filepath = AVATAR_DIR / filename
        filepath.write_bytes(b64decode(image_part["data"]))
        local_url = f"/api/files/avatars/{filename}"
        return {"status": "generated", "avatar_url": local_url}

    except Exception as e:
        logger.error(f"Gemini avatar generation failed: {e}")
        initials = "".join(w[0].upper() for w in name.split()[:2])
        return {
            "status": "fallback",
            "avatar_url": f"/api/agents/avatar/initials/{initials}",
            "reason": str(e),
        }
