"""Kanji routes for JapanApp FastAPI Backend."""

from fastapi import APIRouter, Depends, HTTPException, Query

from app.dependencies.auth import get_auth_token
from app.models.kanji import KanjiListResponse, KanjiDetailItem, KanjiItem
from app.services.kanji import fetch_kanji, fetch_kanji_item

kanji_router = APIRouter(prefix="/kanji", tags=["kanji"])


@kanji_router.get("/list", response_model=KanjiListResponse)
def fetch_kanji_list(
    page: int = Query(default=1, ge=1),
    limit: int = Query(default=20, ge=1, le=100),
    jlpt_level: int | None = Query(default=None, ge=1, le=5),
    radical: str | None = Query(default=None),
    order: str = Query(default="desc", pattern="^(asc|desc)$"),
    token: str = Depends(get_auth_token),
):
    """Fetch a paginated kanji list with optional filters.

    - `jlpt_level` / `radical`: filters.
    - `order`: sort direction by JLPT level, `desc` (N5 -> N1) or `asc`.
    """
    try:
        items, has_more = fetch_kanji(
            page=page,
            limit=limit,
            jlpt_level=jlpt_level,
            radical=radical,
            order=order,
        )
        return KanjiListResponse(items=items, page=page, limit=limit, has_more=has_more)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Database error: {str(e)}")

@kanji_router.get("/{kanji_id}", response_model=KanjiDetailItem)
def fetch_kanji_detail(kanji_id: str, token: str = Depends(get_auth_token)):
	"""Fetch one kanji item by id."""
	try:
		item = fetch_kanji_item(kanji_id)
		if item is None:
			raise HTTPException(status_code=404, detail="Kanji item not found")
		return item
	except HTTPException:
		raise
	except Exception as e:
		raise HTTPException(status_code=500, detail=f"Database error: {str(e)}")