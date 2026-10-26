"""Authenticated favorites endpoints."""

import logging
from contextlib import contextmanager
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query
from psycopg2 import Error as DatabaseError

from app.dependencies.auth import get_current_user
from app.models.favorites import (
    FavoriteIdsRequest,
    FavoriteListResponse,
    FavoriteStatusRequest,
    FavoriteStatusResponse,
    FavoriteType,
)
from app.services.favorites import (
    add_favorite,
    delete_favorite,
    fetch_favorite_ids,
    fetch_favorites,
    import_vocabulary_favorites,
)

logger = logging.getLogger(__name__)


@contextmanager
def _database_errors():
    try:
        yield
    except DatabaseError:
        logger.exception("Favorites database request failed")
        raise HTTPException(status_code=500, detail="Could not update or load favorites")


favorites_router = APIRouter(prefix="/favorites", tags=["favorites"])


@favorites_router.get("", response_model=FavoriteListResponse)
def list_favorites(
    page: int = Query(default=1, ge=1),
    limit: int = Query(default=20, ge=1, le=100),
    item_type: FavoriteType | None = None,
    user: dict = Depends(get_current_user),
):
    with _database_errors():
        items, has_more = fetch_favorites(user["id"], page, limit, item_type)
    return FavoriteListResponse(items=items, page=page, limit=limit, has_more=has_more)


@favorites_router.post("/status", response_model=FavoriteStatusResponse)
def favorite_status(payload: FavoriteStatusRequest, user: dict = Depends(get_current_user)):
    with _database_errors():
        return FavoriteStatusResponse(item_ids=fetch_favorite_ids(
            user["id"], payload.item_type, [str(item_id) for item_id in payload.item_ids]
        ))


@favorites_router.post("/import", status_code=204)
def import_favorites(payload: FavoriteIdsRequest, user: dict = Depends(get_current_user)):
    with _database_errors():
        import_vocabulary_favorites(user["id"], [str(item_id) for item_id in payload.item_ids])


@favorites_router.put("/{item_type}/{item_id}", status_code=204)
def save_favorite(item_type: FavoriteType, item_id: UUID, user: dict = Depends(get_current_user)):
    with _database_errors():
        if not add_favorite(user["id"], item_type, str(item_id)):
            raise HTTPException(status_code=404, detail="Vocabulary or kanji item not found")


@favorites_router.delete("/{item_type}/{item_id}", status_code=204)
def remove_favorite(item_type: FavoriteType, item_id: UUID, user: dict = Depends(get_current_user)):
    with _database_errors():
        delete_favorite(user["id"], item_type, str(item_id))
