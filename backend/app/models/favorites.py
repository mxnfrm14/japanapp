"""Contracts for user-owned vocabulary and kanji favorites."""

from datetime import datetime
from typing import Literal
from uuid import UUID

from pydantic import BaseModel, Field

FavoriteType = Literal["vocabulary", "kanji"]


class FavoriteItem(BaseModel):
    item_type: FavoriteType
    item_id: UUID
    japanese: str
    reading: str | None = None
    meaning: str | None = None
    jlpt_level: int | None = None
    created_at: datetime


class FavoriteListResponse(BaseModel):
    items: list[FavoriteItem]
    page: int
    limit: int
    has_more: bool


class FavoriteIdsRequest(BaseModel):
    item_ids: list[UUID] = Field(max_length=100)


class FavoriteStatusRequest(FavoriteIdsRequest):
    item_type: FavoriteType


class FavoriteStatusResponse(BaseModel):
    item_ids: list[UUID]
