from __future__ import annotations

import json

from backend.tools.base import Tool, ToolRegistry
from backend.tools.google_auth import resolve_google_service


class CreateCalendarEventTool(Tool):
    name = "create_calendar_event"
    description = "Create a Google Calendar event. Returns the event link."
    parameters = {
        "summary": {"type": "string", "description": "Event title"},
        "start": {"type": "string", "description": "Start datetime in ISO 8601 format (e.g. 2026-03-10T09:00:00-05:00)"},
        "end": {"type": "string", "description": "End datetime in ISO 8601 format"},
        "description": {"type": "string", "description": "Optional event description"},
        "attendees": {"type": "string", "description": "Comma-separated email addresses of attendees"},
    }

    async def execute(self, summary: str, start: str, end: str, description: str = "", attendees: str = "", **kwargs) -> str:
        agent_id = kwargs.get("_agent_id")
        try:
            service, _ = await resolve_google_service(
                api_name="calendar",
                version="v3",
                integration="google_calendar",
                agent_id=agent_id,
                delegated_scopes=[
                    "https://www.googleapis.com/auth/calendar",
                ],
            )
        except Exception as e:
            return json.dumps({"success": False, "error": str(e)})

        if service is None:
            return json.dumps({
                "success": False,
                "error": "Google Calendar is not configured. Provision the agent in Google Workspace or add manual OAuth credentials in Settings > Integrations.",
            })

        try:
            event_body: dict = {
                "summary": summary,
                "start": {"dateTime": start},
                "end": {"dateTime": end},
            }
            if description:
                event_body["description"] = description
            if attendees:
                event_body["attendees"] = [
                    {"email": e.strip()} for e in attendees.split(",") if e.strip()
                ]

            event = service.events().insert(calendarId="primary", body=event_body).execute()
            return json.dumps({
                "success": True,
                "event_id": event["id"],
                "link": event.get("htmlLink", ""),
            })
        except Exception as e:
            return json.dumps({"success": False, "error": str(e)})


class ListCalendarEventsTool(Tool):
    name = "list_calendar_events"
    description = "List upcoming Google Calendar events."
    parameters = {
        "time_min": {"type": "string", "description": "Start of time range in ISO 8601 (e.g. 2026-03-01T00:00:00Z)"},
        "time_max": {"type": "string", "description": "End of time range in ISO 8601"},
        "max_results": {"type": "integer", "description": "Maximum events to return (default 10)"},
    }

    async def execute(self, time_min: str, time_max: str, max_results: int = 10, **kwargs) -> str:
        agent_id = kwargs.get("_agent_id")
        try:
            service, _ = await resolve_google_service(
                api_name="calendar",
                version="v3",
                integration="google_calendar",
                agent_id=agent_id,
                delegated_scopes=[
                    "https://www.googleapis.com/auth/calendar.readonly",
                ],
            )
        except Exception as e:
            return json.dumps({"success": False, "error": str(e)})

        if service is None:
            return json.dumps({
                "success": False,
                "error": "Google Calendar is not configured. Provision the agent in Google Workspace or add manual OAuth credentials in Settings > Integrations.",
            })

        try:
            result = service.events().list(
                calendarId="primary",
                timeMin=time_min,
                timeMax=time_max,
                maxResults=max_results,
                singleEvents=True,
                orderBy="startTime",
            ).execute()

            events = []
            for ev in result.get("items", []):
                events.append({
                    "id": ev["id"],
                    "summary": ev.get("summary", "(No title)"),
                    "start": ev.get("start", {}).get("dateTime", ev.get("start", {}).get("date", "")),
                    "end": ev.get("end", {}).get("dateTime", ev.get("end", {}).get("date", "")),
                    "link": ev.get("htmlLink", ""),
                })

            return json.dumps({"success": True, "events": events, "count": len(events)})
        except Exception as e:
            return json.dumps({"success": False, "error": str(e)})


ToolRegistry.register(CreateCalendarEventTool())
ToolRegistry.register(ListCalendarEventsTool())
