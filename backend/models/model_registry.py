"""
Central registry of all available LLM models and their capabilities.

Each model entry declares what it can do (text, image, video, code, marketing)
so agents can be matched to the right model for their role.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from enum import Enum


class ModelCapability(str, Enum):
    TEXT = "text"
    CODE = "code"
    IMAGE_GEN = "image_generation"
    VIDEO_GEN = "video_generation"
    VISION = "vision"
    MARKETING = "marketing"
    CREATIVE_WRITING = "creative_writing"
    DATA_ANALYSIS = "data_analysis"


@dataclass
class ModelInfo:
    id: str
    name: str
    provider: str
    capabilities: list[ModelCapability]
    description: str
    context_window: int = 128_000
    max_output: int = 4096
    is_default: bool = False
    requires_key: str | None = None
    category: str = "general"

    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "name": self.name,
            "provider": self.provider,
            "capabilities": [c.value for c in self.capabilities],
            "description": self.description,
            "context_window": self.context_window,
            "max_output": self.max_output,
            "is_default": self.is_default,
            "category": self.category,
        }


# ── Text / General Purpose Models ──

MODELS: list[ModelInfo] = [
    ModelInfo(
        id="gpt-4o",
        name="GPT-4o",
        provider="openai",
        capabilities=[
            ModelCapability.TEXT, ModelCapability.CODE,
            ModelCapability.VISION, ModelCapability.DATA_ANALYSIS,
        ],
        description="Most capable OpenAI model. Best for complex reasoning, leadership, and multi-step tasks.",
        context_window=128_000,
        max_output=16_384,
        is_default=True,
        requires_key="OPENAI_API_KEY",
        category="general",
    ),
    ModelInfo(
        id="gpt-4o-mini",
        name="GPT-4o Mini",
        provider="openai",
        capabilities=[
            ModelCapability.TEXT, ModelCapability.CODE, ModelCapability.VISION,
        ],
        description="Fast and cost-effective. Good for routine tasks, routing, and quick responses.",
        context_window=128_000,
        max_output=16_384,
        requires_key="OPENAI_API_KEY",
        category="general",
    ),
    ModelInfo(
        id="anthropic/claude-sonnet-4-20250514",
        name="Claude Sonnet 4",
        provider="anthropic",
        capabilities=[
            ModelCapability.TEXT, ModelCapability.CODE,
            ModelCapability.CREATIVE_WRITING, ModelCapability.VISION,
        ],
        description="Excellent for creative writing, nuanced content, and thoughtful analysis.",
        context_window=200_000,
        max_output=8_192,
        requires_key="ANTHROPIC_API_KEY",
        category="general",
    ),
    ModelInfo(
        id="anthropic/claude-haiku-3.5-20241022",
        name="Claude Haiku 3.5",
        provider="anthropic",
        capabilities=[
            ModelCapability.TEXT, ModelCapability.CODE,
        ],
        description="Ultra-fast Anthropic model. Great for high-volume, low-latency tasks.",
        context_window=200_000,
        max_output=8_192,
        requires_key="ANTHROPIC_API_KEY",
        category="general",
    ),

    # ── Creative / Marketing Models ──

    ModelInfo(
        id="gpt-4o",
        name="GPT-4o (Marketing)",
        provider="openai",
        capabilities=[
            ModelCapability.TEXT, ModelCapability.MARKETING,
            ModelCapability.CREATIVE_WRITING, ModelCapability.DATA_ANALYSIS,
        ],
        description="GPT-4o optimized for marketing copy, campaigns, SEO content, and brand voice.",
        context_window=128_000,
        max_output=16_384,
        requires_key="OPENAI_API_KEY",
        category="marketing",
    ),
    ModelInfo(
        id="anthropic/claude-sonnet-4-20250514",
        name="Claude Sonnet 4 (Creative)",
        provider="anthropic",
        capabilities=[
            ModelCapability.CREATIVE_WRITING, ModelCapability.MARKETING,
            ModelCapability.TEXT,
        ],
        description="Best-in-class for long-form content, storytelling, brand narratives, and editorial work.",
        context_window=200_000,
        max_output=8_192,
        requires_key="ANTHROPIC_API_KEY",
        category="marketing",
    ),

    # ── Image Generation Models ──

    ModelInfo(
        id="dall-e-3",
        name="DALL-E 3",
        provider="openai",
        capabilities=[ModelCapability.IMAGE_GEN],
        description="Generate high-quality images from text prompts. Ideal for marketing visuals, social media, and design concepts.",
        context_window=0,
        max_output=0,
        requires_key="OPENAI_API_KEY",
        category="image",
    ),
    ModelInfo(
        id="gpt-image-1",
        name="GPT Image 1",
        provider="openai",
        capabilities=[ModelCapability.IMAGE_GEN, ModelCapability.VISION],
        description="Latest OpenAI image model with editing capabilities. Can generate and modify images.",
        context_window=0,
        max_output=0,
        requires_key="OPENAI_API_KEY",
        category="image",
    ),

    # ── Video Generation Models ──

    ModelInfo(
        id="runway/gen3",
        name="Runway Gen-3 Alpha",
        provider="runway",
        capabilities=[ModelCapability.VIDEO_GEN],
        description="Generate short video clips from text or image prompts. Great for social media content and ads.",
        context_window=0,
        max_output=0,
        requires_key="RUNWAY_API_KEY",
        category="video",
    ),
    ModelInfo(
        id="replicate/minimax-video",
        name="MiniMax Video",
        provider="replicate",
        capabilities=[ModelCapability.VIDEO_GEN],
        description="High-quality video generation via Replicate. Supports text-to-video and image-to-video.",
        context_window=0,
        max_output=0,
        requires_key="REPLICATE_API_TOKEN",
        category="video",
    ),

    # ── Code-Focused Models ──

    ModelInfo(
        id="gpt-4o",
        name="GPT-4o (Engineering)",
        provider="openai",
        capabilities=[
            ModelCapability.CODE, ModelCapability.TEXT,
            ModelCapability.DATA_ANALYSIS,
        ],
        description="GPT-4o optimized for code generation, debugging, architecture, and technical documentation.",
        context_window=128_000,
        max_output=16_384,
        requires_key="OPENAI_API_KEY",
        category="engineering",
    ),
    ModelInfo(
        id="anthropic/claude-sonnet-4-20250514",
        name="Claude Sonnet 4 (Engineering)",
        provider="anthropic",
        capabilities=[
            ModelCapability.CODE, ModelCapability.TEXT,
            ModelCapability.DATA_ANALYSIS,
        ],
        description="Excellent for code review, refactoring, and complex engineering tasks with long context.",
        context_window=200_000,
        max_output=8_192,
        requires_key="ANTHROPIC_API_KEY",
        category="engineering",
    ),
]


def get_models_by_category(category: str | None = None) -> list[ModelInfo]:
    if category is None:
        return MODELS
    return [m for m in MODELS if m.category == category]


def get_models_by_capability(capability: ModelCapability) -> list[ModelInfo]:
    return [m for m in MODELS if capability in m.capabilities]


def get_model_info(model_id: str) -> ModelInfo | None:
    for m in MODELS:
        if m.id == model_id:
            return m
    return None


def get_unique_models() -> list[ModelInfo]:
    """Get models de-duplicated by id, keeping the first (general) occurrence."""
    seen: set[str] = set()
    result: list[ModelInfo] = []
    for m in MODELS:
        if m.id not in seen:
            seen.add(m.id)
            result.append(m)
    return result


def get_categories() -> list[dict]:
    return [
        {"id": "general", "name": "General Purpose", "description": "Text generation, reasoning, and analysis"},
        {"id": "marketing", "name": "Marketing & Content", "description": "Copywriting, SEO, campaigns, and brand content"},
        {"id": "image", "name": "Image Generation", "description": "Create visuals, designs, and marketing graphics"},
        {"id": "video", "name": "Video Generation", "description": "Generate video clips for social media and ads"},
        {"id": "engineering", "name": "Engineering", "description": "Code generation, debugging, and technical tasks"},
    ]
