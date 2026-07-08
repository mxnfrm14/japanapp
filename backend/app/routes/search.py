"""Search routes for JapanApp FastAPI Backend."""

from fastapi import APIRouter, Depends, HTTPException, Query

from app.dependencies.auth import get_auth_token
from app.models.search import SearchItem
from app.services.search import search_vocabulary_and_kanji

search_router = APIRouter(tags=["search"])


def parse_search_query(q: str) -> tuple[str, str | None]:
    """Returns (cleaned_query, type_filter)."""
    for prefix in ("#kanji",):
        if q.lower().startswith(prefix):
            return q[len(prefix):].strip(), "kanji"
    for prefix in ("#vocabulary", "#vocab"):
        if q.lower().startswith(prefix):
            return q[len(prefix):].strip(), "vocabulary"
    return q, None


@search_router.get("/search", response_model=list[SearchItem])
def search(
    q: str = Query(..., min_length=1),
    limit: int = Query(default=20, ge=1, le=100),
    jlpt: int | None = Query(default=None, ge=1, le=5),
    tag: str | None = Query(default=None),
    token: str = Depends(get_auth_token),
):
    """Search vocabulary and kanji with optional JLPT and tag filters."""
    try:
        cleaned_query, type_filter = parse_search_query(q)
        return search_vocabulary_and_kanji(
            q=cleaned_query,
            limit=limit,
            jlpt=jlpt,
            tag=tag,
            type_filter=type_filter,
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Database error: {str(e)}")
