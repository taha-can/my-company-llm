from __future__ import annotations

import json

import httpx

from backend.engine.credentials import get_credentials
from backend.tools.base import Tool, ToolRegistry


class LinkedInPostTool(Tool):
    name = "post_to_linkedin"
    description = "Create a text post on LinkedIn. Returns the post URL on success."
    parameters = {
        "text": {
            "type": "string",
            "description": "The post text content",
        },
    }

    async def execute(self, text: str, **kwargs) -> str:
        agent_id = kwargs.get("_agent_id")
        creds = await get_credentials("linkedin", agent_id)
        access_token = creds.get("access_token")

        if not access_token:
            return json.dumps({
                "success": False,
                "error": "LinkedIn API credentials not configured. Please add them in Settings > Integrations.",
                "post_content": text,
            })

        try:
            async with httpx.AsyncClient() as client:
                profile_resp = await client.get(
                    "https://api.linkedin.com/v2/userinfo",
                    headers={"Authorization": f"Bearer {access_token}"},
                )
                profile_resp.raise_for_status()
                user_sub = profile_resp.json().get("sub")

                post_data = {
                    "author": f"urn:li:person:{user_sub}",
                    "lifecycleState": "PUBLISHED",
                    "specificContent": {
                        "com.linkedin.ugc.ShareContent": {
                            "shareCommentary": {"text": text},
                            "shareMediaCategory": "NONE",
                        }
                    },
                    "visibility": {
                        "com.linkedin.ugc.MemberNetworkVisibility": "PUBLIC"
                    },
                }

                resp = await client.post(
                    "https://api.linkedin.com/v2/ugcPosts",
                    json=post_data,
                    headers={
                        "Authorization": f"Bearer {access_token}",
                        "Content-Type": "application/json",
                        "X-Restli-Protocol-Version": "2.0.0",
                    },
                )
                resp.raise_for_status()
                post_id = resp.json().get("id", "")
                return json.dumps({
                    "success": True,
                    "post_id": post_id,
                    "url": f"https://www.linkedin.com/feed/update/{post_id}",
                })
        except Exception as e:
            return json.dumps({"success": False, "error": str(e)})


ToolRegistry.register(LinkedInPostTool())
