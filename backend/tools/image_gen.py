"""Image generation tool using OpenAI DALL-E 3 / GPT Image."""

from __future__ import annotations

import json
import os
import uuid
from pathlib import Path

from backend.tools.base import Tool, ToolRegistry


class GenerateImageTool(Tool):
    name = "generate_image"
    description = (
        "Generate an image from a text prompt using DALL-E 3. "
        "Returns the image URL or local file path. Use for marketing visuals, "
        "social media graphics, product mockups, and design concepts."
    )
    parameters = {
        "prompt": {
            "type": "string",
            "description": "Detailed description of the image to generate. Be specific about style, composition, colors, and mood.",
        },
        "size": {
            "type": "string",
            "enum": ["1024x1024", "1792x1024", "1024x1792"],
            "description": "Image dimensions. Use 1792x1024 for landscape, 1024x1792 for portrait, 1024x1024 for square.",
        },
        "style": {
            "type": "string",
            "enum": ["vivid", "natural"],
            "description": "vivid for hyper-real/dramatic, natural for more realistic/subdued.",
        },
    }

    async def execute(self, prompt: str, size: str = "1024x1024", style: str = "vivid", **kwargs) -> str:
        api_key = os.getenv("OPENAI_API_KEY", "")
        if not api_key or api_key == "sk-...":
            return json.dumps({"error": "OpenAI API key not configured. Add OPENAI_API_KEY to .env"})

        try:
            import httpx

            async with httpx.AsyncClient(timeout=120) as client:
                resp = await client.post(
                    "https://api.openai.com/v1/images/generations",
                    headers={"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"},
                    json={
                        "model": "dall-e-3",
                        "prompt": prompt,
                        "n": 1,
                        "size": size,
                        "style": style,
                        "response_format": "url",
                    },
                )

                if resp.status_code != 200:
                    return json.dumps({"error": f"DALL-E API error: {resp.text}"})

                data = resp.json()
                image_url = data["data"][0]["url"]
                revised_prompt = data["data"][0].get("revised_prompt", prompt)

                return json.dumps({
                    "success": True,
                    "image_url": image_url,
                    "revised_prompt": revised_prompt,
                    "size": size,
                    "style": style,
                })
        except Exception as e:
            return json.dumps({"error": f"Image generation failed: {str(e)}"})


ToolRegistry.register(GenerateImageTool())
