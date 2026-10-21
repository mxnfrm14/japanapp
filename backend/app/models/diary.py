"""Pydantic models for diary-related API payloads."""

from datetime import date as date_type, datetime
from typing import Any, Literal

from pydantic import BaseModel, Field


class DiaryEntry(BaseModel):
    """A single diary day, keyed by the writer's local calendar date."""

    id: str
    date: date_type
    text: str
    correction: dict[str, Any] | None = None
    created_at: datetime
    updated_at: datetime


class DiaryUpsertRequest(BaseModel):
    """Body for upserting the entry of a given day."""

    text: str
    correction: dict[str, Any] | None = None


class DiaryListResponse(BaseModel):
    """Paginated diary list response."""

    items: list[DiaryEntry]
    page: int
    limit: int
    has_more: bool


class CorrectionNote(BaseModel):
    """One flagged issue within a correction."""

    original: str = ""
    corrected: str = ""
    kind: Literal["particle", "conjugation", "word choice", "naturalness", "orthography", "grammar"] = "grammar"
    explanation: str = ""


class CorrectionRequest(BaseModel):
    """Body for requesting a correction of a diary entry."""

    text: str = Field(min_length=1, max_length=5000)
    style_mode: Literal["auto", "plain", "polite"] = "auto"
    entry_date: date_type | None = None


class CorrectionResponse(BaseModel):
    """Structured correction of a diary entry."""

    detected_register: Literal["plain", "polite", "mixed", "unknown"] = "unknown"
    register_note: str = ""
    corrected: str
    notes: list[CorrectionNote] = Field(default_factory=list)
    encouragement: str = ""
