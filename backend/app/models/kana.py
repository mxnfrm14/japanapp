"""Pydantic models for kana-related API payloads."""

from datetime import datetime
from typing import Literal

from pydantic import BaseModel


class KanaItem(BaseModel):
    """Kana reference row returned by the API."""

    id: str
    script_type: Literal["hiragana", "katakana"]
    character: str
    romaji: str
    group_name: str | None = None
    stroke_count: int | None = None
    order_index: int
    created_at: datetime
