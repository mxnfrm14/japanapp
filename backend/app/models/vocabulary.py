"""Pydantic models for vocabulary-related API payloads."""

from pydantic import BaseModel, Field
from typing import Any
from datetime import datetime


class VocabularyItem(BaseModel):
    """Vocabulary reference row returned by the API."""

    id: str
    japanese: str
    reading: str | None = None
    meaning: str | None = None
    tags: list[str] = Field(default_factory=list)
    difficulty_level: int | None = None
    frequency_rank: int | None = None
    created_at: datetime

class VocabularyDetailItem(VocabularyItem):
    """Expanded vocabulary payload returned by the detail endpoint."""

    example_sentence: str | None = None
    example_translation: str | None = None
    kanji_breakdown: dict[str, Any] | list[Any] | str | None = None
    jisho_url: str | None = None


class VocabularyListResponse(BaseModel):
    """Paginated vocabulary list response."""

    items: list[VocabularyItem]
    page: int
    limit: int
    has_more: bool


class TagListResponse(BaseModel):
    """List of all unique tags."""

    tags: list[str]