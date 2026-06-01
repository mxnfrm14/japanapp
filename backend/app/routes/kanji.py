"""Kanji routes for JapanApp FastAPI Backend."""

from fastapi import APIRouter, Depends, HTTPException, Query

from app.dependencies.auth import get_auth_token
from app.models.kanji import KanjiListResponse
from app.services.kanji import fetch_kanji

kanji_router = APIRouter(prefix="/kanji", tags=["kanji"])


@kanji_router.get("/list", response_model=KanjiListResponse)
def fetch_kanji_list(
    page: int = Query(default=1, ge=1),
    limit: int = Query(default=20, ge=1, le=100),
    jlpt_level: int | None = Query(default=None, ge=1, le=5),
    radical: str | None = Query(default=None),
    token: str = Depends(get_auth_token),
):
    """Fetch a paginated kanji list with optional filters."""
    try:
        items, has_more = fetch_kanji(
            page=page,
            limit=limit,
            jlpt_level=jlpt_level,
            radical=radical,
        )
        return KanjiListResponse(items=items, page=page, limit=limit, has_more=has_more)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Database error: {str(e)}")
