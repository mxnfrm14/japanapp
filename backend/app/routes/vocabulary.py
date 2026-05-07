"""Vocabulary routes for JapanApp FastAPI Backend."""

from fastapi import APIRouter, Depends, HTTPException, Query

from app.dependencies.auth import get_auth_token
from app.models.vocabulary import VocabularyListResponse, TagListResponse
from app.services.vocabulary import fetch_vocabulary, fetch_vocabulary_tags

vocabulary_router = APIRouter(prefix="/vocabulary", tags=["vocabulary"])

@vocabulary_router.get("/list", response_model=VocabularyListResponse)
def fetch_vocabulary_list(
	page: int = Query(default=1, ge=1),
	limit: int = Query(default=20, ge=1, le=100),
	jlpt: int | None = Query(default=None, ge=1, le=5),
	tag: str | None = Query(default=None),
	token: str = Depends(get_auth_token),
):
	"""Fetch a paginated vocabulary list optimized for large result sets.

	Optional filters:
	- `jlpt`: restrict to vocabulary with the given difficulty level.
	- `tag`: restrict to vocabulary items containing the given tag.
	"""
	try:
		items, has_more = fetch_vocabulary(page=page, limit=limit, jlpt=jlpt, tag=tag)
		return VocabularyListResponse(items=items, page=page, limit=limit, has_more=has_more)
	except Exception as e:
		raise HTTPException(status_code=500, detail=f"Database error: {str(e)}")


@vocabulary_router.get("/tags", response_model=TagListResponse)
def fetch_tags(token: str = Depends(get_auth_token)):
	"""Fetch all unique tags across vocabulary items."""
	try:
		tags = fetch_vocabulary_tags()
		return TagListResponse(tags=tags)
	except Exception as e:
		raise HTTPException(status_code=500, detail=f"Database error: {str(e)}")