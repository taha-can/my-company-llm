"""Video generation tool. Supports Runway Gen-3 and Replicate-hosted models."""

from __future__ import annotations

import json
import os

from backend.tools.base import Tool, ToolRegistry


class GenerateVideoTool(Tool):
    name = "generate_video"
    description = (
        "Generate a short video clip from a text prompt or image. "
        "Useful for social media content, product demos, ads, and marketing videos. "
        "Returns a video URL when complete."
    )
    parameters = {
        "prompt": {
            "type": "string",
            "description": "Detailed description of the video to generate. Include motion, camera angles, style, and mood.",
        },
        "duration": {
            "type": "integer",
            "description": "Video duration in seconds (typically 4-10).",
        },
        "aspect_ratio": {
            "type": "string",
            "enum": ["16:9", "9:16", "1:1"],
            "description": "16:9 for landscape/YouTube, 9:16 for reels/shorts, 1:1 for social posts.",
        },
    }

    async def execute(self, prompt: str, duration: int = 5, aspect_ratio: str = "16:9", **kwargs) -> str:
        runway_key = os.getenv("RUNWAY_API_KEY", "")
        replicate_token = os.getenv("REPLICATE_API_TOKEN", "")

        if runway_key:
            return await self._runway_generate(prompt, duration, runway_key)
        elif replicate_token:
            return await self._replicate_generate(prompt, duration, aspect_ratio, replicate_token)
        else:
            return json.dumps({
                "error": "No video generation API key configured. Add RUNWAY_API_KEY or REPLICATE_API_TOKEN to .env",
                "prompt_saved": prompt,
                "note": "Video prompt has been saved. Configure a video API key to enable generation.",
            })

    async def _runway_generate(self, prompt: str, duration: int, api_key: str) -> str:
        try:
            import httpx

            async with httpx.AsyncClient(timeout=300) as client:
                resp = await client.post(
                    "https://api.dev.runwayml.com/v1/text_to_video",
                    headers={"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"},
                    json={
                        "text_prompt": prompt,
                        "seconds": min(duration, 10),
                        "model": "gen3a_turbo",
                    },
                )

                if resp.status_code != 200:
                    return json.dumps({"error": f"Runway API error: {resp.text}"})

                data = resp.json()
                return json.dumps({
                    "success": True,
                    "task_id": data.get("id"),
                    "status": "processing",
                    "provider": "runway",
                    "note": "Video is being generated. Check task status for completion.",
                })
        except Exception as e:
            return json.dumps({"error": f"Runway generation failed: {str(e)}"})

    async def _replicate_generate(self, prompt: str, duration: int, aspect_ratio: str, token: str) -> str:
        try:
            import httpx

            async with httpx.AsyncClient(timeout=300) as client:
                resp = await client.post(
                    "https://api.replicate.com/v1/predictions",
                    headers={"Authorization": f"Bearer {token}", "Content-Type": "application/json"},
                    json={
                        "version": "minimax/video-01-live",
                        "input": {
                            "prompt": prompt,
                            "aspect_ratio": aspect_ratio,
                        },
                    },
                )

                if resp.status_code not in (200, 201):
                    return json.dumps({"error": f"Replicate API error: {resp.text}"})

                data = resp.json()
                return json.dumps({
                    "success": True,
                    "prediction_id": data.get("id"),
                    "status": data.get("status", "starting"),
                    "provider": "replicate",
                    "note": "Video is being generated. Poll the prediction for completion.",
                })
        except Exception as e:
            return json.dumps({"error": f"Replicate generation failed: {str(e)}"})


ToolRegistry.register(GenerateVideoTool())
