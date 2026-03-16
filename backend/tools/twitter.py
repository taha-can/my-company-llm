from __future__ import annotations

import json

import tweepy

from backend.engine.credentials import get_credentials
from backend.tools.base import Tool, ToolRegistry


async def _get_twitter_client(agent_id: str | None = None) -> tweepy.Client | None:
    creds = await get_credentials("twitter", agent_id)
    if not creds.get("api_key"):
        return None
    return tweepy.Client(
        consumer_key=creds["api_key"],
        consumer_secret=creds.get("api_secret", ""),
        access_token=creds.get("access_token", ""),
        access_token_secret=creds.get("access_secret", ""),
    )


class TwitterPostTool(Tool):
    name = "post_to_twitter"
    description = "Post a tweet to Twitter/X. Returns the tweet URL on success."
    parameters = {
        "text": {
            "type": "string",
            "description": "The tweet text (max 280 characters)",
        },
    }

    async def execute(self, text: str, **kwargs) -> str:
        agent_id = kwargs.get("_agent_id")
        client = await _get_twitter_client(agent_id)
        if client is None:
            return json.dumps({
                "success": False,
                "error": "Twitter API credentials not configured. Please add them in Settings > Integrations.",
                "content": text,
            })

        try:
            response = client.create_tweet(text=text)
            tweet_id = response.data["id"]
            return json.dumps({
                "success": True,
                "tweet_id": tweet_id,
                "url": f"https://x.com/i/status/{tweet_id}",
            })
        except Exception as e:
            return json.dumps({"success": False, "error": str(e)})


class TwitterThreadTool(Tool):
    name = "post_twitter_thread"
    description = "Post a thread (multiple connected tweets) to Twitter/X."
    parameters = {
        "tweets": {
            "type": "array",
            "items": {"type": "string"},
            "description": "List of tweet texts in thread order",
        },
    }

    async def execute(self, tweets: list[str], **kwargs) -> str:
        agent_id = kwargs.get("_agent_id")
        client = await _get_twitter_client(agent_id)
        if client is None:
            return json.dumps({
                "success": False,
                "error": "Twitter API credentials not configured. Please add them in Settings > Integrations.",
                "thread_content": tweets,
            })

        try:
            tweet_ids = []
            reply_to = None
            for text in tweets:
                kw = {}
                if reply_to:
                    kw["in_reply_to_tweet_id"] = reply_to
                response = client.create_tweet(text=text, **kw)
                tid = response.data["id"]
                tweet_ids.append(tid)
                reply_to = tid

            return json.dumps({
                "success": True,
                "tweet_ids": tweet_ids,
                "url": f"https://x.com/i/status/{tweet_ids[0]}",
            })
        except Exception as e:
            return json.dumps({"success": False, "error": str(e)})


ToolRegistry.register(TwitterPostTool())
ToolRegistry.register(TwitterThreadTool())
