"""Diary routes for JapanApp FastAPI Backend."""

from datetime import date

from fastapi import APIRouter, Depends, HTTPException, Query

from app.dependencies.auth import get_current_user
from app.models.diary import (
	CorrectionRequest,
	CorrectionResponse,
	DiaryEntry,
	DiaryListResponse,
	DiaryUpsertRequest,
)
from app.services.diary import (
	delete_diary_entry,
	fetch_diary_entry,
	fetch_diary_list,
	upsert_diary_entry,
)
from app.services.diary_correction import request_correction

diary_router = APIRouter(prefix="/diary", tags=["diary"])


@diary_router.get("/list", response_model=DiaryListResponse)
def fetch_diary_list_route(
	page: int = Query(default=1, ge=1),
	limit: int = Query(default=20, ge=1, le=100),
	from_: date | None = Query(default=None, alias="from"),
	to: date | None = Query(default=None),
	user: dict = Depends(get_current_user),
):
	"""Fetch a paginated diary entry list for the current user, newest day first."""
	try:
		items, has_more = fetch_diary_list(
			user_id=user["id"], page=page, limit=limit, date_from=from_, date_to=to
		)
		return DiaryListResponse(items=items, page=page, limit=limit, has_more=has_more)
	except Exception as e:
		raise HTTPException(status_code=500, detail=f"Database error: {str(e)}")


@diary_router.get("/{entry_date}", response_model=DiaryEntry)
def fetch_diary_entry_route(entry_date: date, user: dict = Depends(get_current_user)):
	"""Fetch the diary entry for one calendar day."""
	try:
		entry = fetch_diary_entry(user_id=user["id"], entry_date=entry_date)
		if entry is None:
			raise HTTPException(status_code=404, detail="Diary entry not found")
		return entry
	except HTTPException:
		raise
	except Exception as e:
		raise HTTPException(status_code=500, detail=f"Database error: {str(e)}")


@diary_router.put("/{entry_date}", response_model=DiaryEntry)
def upsert_diary_entry_route(
	entry_date: date,
	payload: DiaryUpsertRequest,
	user: dict = Depends(get_current_user),
):
	"""Create or replace the diary entry for one calendar day."""
	try:
		return upsert_diary_entry(
			user_id=user["id"],
			entry_date=entry_date,
			text=payload.text,
			correction=payload.correction,
		)
	except Exception as e:
		raise HTTPException(status_code=500, detail=f"Database error: {str(e)}")


@diary_router.delete("/{entry_date}", status_code=204)
def delete_diary_entry_route(entry_date: date, user: dict = Depends(get_current_user)):
	"""Delete the diary entry for one calendar day."""
	try:
		delete_diary_entry(user_id=user["id"], entry_date=entry_date)
	except Exception as e:
		raise HTTPException(status_code=500, detail=f"Database error: {str(e)}")


@diary_router.post("/correct", response_model=CorrectionResponse)
def correct_diary_entry_route(payload: CorrectionRequest, user: dict = Depends(get_current_user)):
	"""Correct a diary entry via a structured, JSON-mode Mistral completion."""
	try:
		return request_correction(
			user_id=user["id"],
			text=payload.text,
			style_mode=payload.style_mode,
			entry_date=payload.entry_date,
		)
	except TimeoutError as exc:
		raise HTTPException(status_code=504, detail=str(exc) or "AI service timed out")
	except RuntimeError as exc:
		raise HTTPException(status_code=502, detail=str(exc) or "AI service request failed")
