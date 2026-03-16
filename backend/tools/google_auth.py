from __future__ import annotations

import json

from backend.engine.credentials import get_credentials


def _build_google_service_oauth(
    api_name: str,
    version: str,
    creds: dict[str, str],
):
    from google.oauth2.credentials import Credentials
    from googleapiclient.discovery import build

    credentials = Credentials(
        token=None,
        refresh_token=creds["refresh_token"],
        client_id=creds["client_id"],
        client_secret=creds["client_secret"],
        token_uri="https://oauth2.googleapis.com/token",
    )
    return build(api_name, version, credentials=credentials)


def _build_google_service_delegated(
    api_name: str,
    version: str,
    sender_email: str,
    ws_creds: dict[str, str],
    scopes: list[str],
):
    from google.oauth2 import service_account
    from googleapiclient.discovery import build

    sa_info = json.loads(ws_creds["service_account_json"])
    credentials = service_account.Credentials.from_service_account_info(
        sa_info,
        scopes=scopes,
        subject=sender_email,
    )
    return build(api_name, version, credentials=credentials)


def _format_google_auth_error(
    error: Exception,
    *,
    auth_mode: str,
    scopes: list[str],
    sender_email: str | None = None,
) -> Exception:
    message = str(error)
    lowered = message.lower()

    if auth_mode == "delegated" and (
        "requested client not authorized" in lowered
        or "unauthorized_client" in lowered
        or "access_denied" in lowered
    ):
        scope_list = ", ".join(scopes)
        sender_hint = f" for {sender_email}" if sender_email else ""
        return RuntimeError(
            "Google Workspace domain-wide delegation is not authorized"
            f"{sender_hint}. Enable Domain-wide Delegation for the configured service account "
            "and add its client ID in Google Admin Console with these scopes: "
            f"{scope_list}."
        )

    if auth_mode == "oauth" and (
        "requested client not authorized" in lowered
        or "unauthorized_client" in lowered
        or "access_denied" in lowered
    ):
        return RuntimeError(
            "Google OAuth client is not authorized for this API. Verify the configured client ID, "
            "client secret, consent screen, enabled API, and refresh token."
        )

    return error


async def resolve_google_service(
    *,
    api_name: str,
    version: str,
    integration: str,
    agent_id: str | None,
    delegated_scopes: list[str],
    explicit_sender_email: str | None = None,
):
    """Resolve delegated Workspace auth first, then manual OAuth fallback."""
    creds = await get_credentials(integration, agent_id)

    sender_email = explicit_sender_email or creds.get("sender_email")
    if not sender_email and integration != "google_gmail":
        gmail_creds = await get_credentials("google_gmail", agent_id)
        sender_email = gmail_creds.get("sender_email")

    if sender_email:
        ws_creds = await get_credentials("google_workspace_admin")
        if ws_creds.get("service_account_json"):
            try:
                return (
                    _build_google_service_delegated(
                        api_name,
                        version,
                        sender_email,
                        ws_creds,
                        delegated_scopes,
                    ),
                    sender_email,
                )
            except Exception as e:
                raise _format_google_auth_error(
                    e,
                    auth_mode="delegated",
                    scopes=delegated_scopes,
                    sender_email=sender_email,
                ) from e

    if creds.get("refresh_token"):
        try:
            return _build_google_service_oauth(api_name, version, creds), None
        except Exception as e:
            raise _format_google_auth_error(
                e,
                auth_mode="oauth",
                scopes=delegated_scopes,
            ) from e

    return None, sender_email
