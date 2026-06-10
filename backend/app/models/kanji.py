"""Pydantic models for kanji-related API payloads."""

from datetime import datetime

from pydantic import BaseModel, Field


class KanjiItem(BaseModel):
    """Kanji reference row returned by the API."""

    id: str
    kanji: str
    meaning: str
    onyomi: list[str] = Field(default_factory=list)
    kunyomi: list[str] = Field(default_factory=list)
    stroke_count: int | None = None
    radical: str | None = None
    jlpt_level: int | None = None
    frequency_rank: int | None = None
    components: dict | list | None = None
    stroke_order_gif_uri: str | None = None
    notes: str | None = None
    created_at: datetime
    updated_at: datetime

class KanjiDetailItem(KanjiItem):
    """Expanded kanji payload returned by the detail endpoint."""

    pass

class KanjiListResponse(BaseModel):
    """Paginated kanji list response."""

    items: list[KanjiItem]
    page: int
    limit: int
    has_more: bool
