from __future__ import annotations

from fastapi import APIRouter

from backend.models.model_registry import (
    MODELS,
    get_models_by_category,
    get_models_by_capability,
    get_categories,
    ModelCapability,
)

router = APIRouter()


@router.get("")
async def list_models(category: str | None = None, capability: str | None = None):
    if capability:
        try:
            cap = ModelCapability(capability)
            models = get_models_by_capability(cap)
        except ValueError:
            models = MODELS
    elif category:
        models = get_models_by_category(category)
    else:
        models = MODELS

    return {
        "models": [m.to_dict() for m in models],
        "categories": get_categories(),
    }


@router.get("/categories")
async def list_categories():
    return get_categories()
