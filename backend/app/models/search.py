"""Pydantic models for unified search responses."""

from typing import Literal

from pydantic import BaseModel, Field


class SearchItem(BaseModel):
    """Unified search result returned by the `/search` endpoint."""

    id: str
    japanese: str
    reading: str | None = None
    readings: list[str] = Field(default_factory=list)
    meaning: str | None = None
    tags: list[str] = Field(default_factory=list)
    difficulty_level: int | None = None
    frequency_rank: int | None = None
    type: Literal["vocabulary", "kanji"]
