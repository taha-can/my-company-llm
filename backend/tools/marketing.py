"""Marketing content generation tool using LLMs for structured marketing outputs."""

from __future__ import annotations

import json
import os

from litellm import acompletion

from backend.config import settings
from backend.tools.base import Tool, ToolRegistry


MARKETING_SYSTEM_PROMPT = """\
You are a world-class marketing strategist and copywriter. Generate professional, \
conversion-optimized marketing content. Always return structured JSON output.

Brand context will be provided when available. Match the brand's tone and voice.
"""


class GenerateMarketingContentTool(Tool):
    name = "generate_marketing_content"
    description = (
        "Generate professional marketing content: social media posts, ad copy, "
        "email campaigns, blog outlines, SEO meta descriptions, landing page copy, "
        "press releases, and more. Returns structured content ready to publish."
    )
    parameters = {
        "content_type": {
            "type": "string",
            "enum": [
                "social_post",
                "ad_copy",
                "email_campaign",
                "blog_outline",
                "seo_meta",
                "landing_page",
                "press_release",
                "product_description",
                "newsletter",
            ],
            "description": "Type of marketing content to generate.",
        },
        "brief": {
            "type": "string",
            "description": "Detailed brief: what to promote, target audience, key messages, tone, and any constraints.",
        },
        "platform": {
            "type": "string",
            "description": "Target platform (e.g., twitter, linkedin, instagram, email, website). Affects format and length.",
        },
    }

    async def execute(self, content_type: str, brief: str, platform: str = "general", **kwargs) -> str:
        try:
            user_prompt = (
                f"Content type: {content_type}\n"
                f"Platform: {platform}\n"
                f"Brief: {brief}\n\n"
                "Generate the content as a JSON object with these fields:\n"
                '- "headline": main headline or subject line\n'
                '- "body": the main content\n'
                '- "cta": call-to-action text\n'
                '- "hashtags": relevant hashtags (if social media)\n'
                '- "seo_keywords": target keywords (if applicable)\n'
                '- "variations": 2 alternative versions of the headline\n'
                '- "notes": any strategic notes or recommendations'
            )

            model = settings.default_creative_model
            api_key = settings.anthropic_api_key if model.startswith("anthropic/") else settings.openai_api_key
            response = await acompletion(
                model=model,
                messages=[
                    {"role": "system", "content": MARKETING_SYSTEM_PROMPT},
                    {"role": "user", "content": user_prompt},
                ],
                response_format={"type": "json_object"},
                api_key=api_key or None,
            )

            content = response.choices[0].message.content
            parsed = json.loads(content)

            return json.dumps({
                "success": True,
                "content_type": content_type,
                "platform": platform,
                "model_used": model,
                **parsed,
            })
        except Exception as e:
            return json.dumps({"error": f"Marketing content generation failed: {str(e)}"})


ToolRegistry.register(GenerateMarketingContentTool())
