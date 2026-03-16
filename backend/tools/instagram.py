from __future__ import annotations

import json

import httpx

from backend.engine.credentials import get_credentials
from backend.tools.base import Tool, ToolRegistry

GRAPH_API_BASE = "https://graph.facebook.com/v19.0"


class InstagramPostTool(Tool):
    name = "post_to_instagram"
    description = (
        "Create a photo post on Instagram. Requires a publicly accessible image URL. "
        "Returns the post URL on success."
    )
    parameters = {
        "image_url": {
            "type": "string",
            "description": "Publicly accessible URL of the image to post",
        },
        "caption": {
            "type": "string",
            "description": "Post caption text (can include hashtags)",
        },
    }

    async def execute(self, image_url: str, caption: str, **kwargs) -> str:
        agent_id = kwargs.get("_agent_id")
        creds = await get_credentials("instagram", agent_id)
        access_token = creds.get("access_token")
        user_id = creds.get("user_id")

        if not access_token or not user_id:
            return json.dumps({
                "success": False,
                "error": "Instagram API credentials not configured. Please add them in Settings > Integrations.",
                "caption": caption,
                "image_url": image_url,
            })

        try:
            async with httpx.AsyncClient() as client:
                container_resp = await client.post(
                    f"{GRAPH_API_BASE}/{user_id}/media",
                    params={
                        "image_url": image_url,
                        "caption": caption,
                        "access_token": access_token,
                    },
                )
                container_resp.raise_for_status()
                container_id = container_resp.json()["id"]

                publish_resp = await client.post(
                    f"{GRAPH_API_BASE}/{user_id}/media_publish",
                    params={
                        "creation_id": container_id,
                        "access_token": access_token,
                    },
                )
                publish_resp.raise_for_status()
                media_id = publish_resp.json()["id"]

                return json.dumps({
                    "success": True,
                    "media_id": media_id,
                    "url": f"https://www.instagram.com/p/{media_id}/",
                })
        except Exception as e:
            return json.dumps({"success": False, "error": str(e)})


ToolRegistry.register(InstagramPostTool())
