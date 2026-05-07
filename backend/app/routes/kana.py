"""Kana routes for JapanApp FastAPI Backend"""

from fastapi import APIRouter, HTTPException, Depends

from app.dependencies.auth import get_auth_token
from app.models.kana import KanaItem
from app.services.kana import fetch_kana as db_fetch_kana

kana_router = APIRouter(prefix="/kana", tags=["kana"])


def _fetch_kana(script_type: str | None = None) -> list[KanaItem]:
	try:
		rows = db_fetch_kana(script_type=script_type)
		return rows
	except Exception as e:
		raise HTTPException(status_code=500, detail=f"Database error: {e}")


@kana_router.get("", response_model=list[KanaItem])
def fetch_kana(
	token: str = Depends(get_auth_token),
):
	return _fetch_kana()


@kana_router.get("/hiragana", response_model=list[KanaItem])
def fetch_hiragana_kana(
	token: str = Depends(get_auth_token),
):
	return _fetch_kana("hiragana")


@kana_router.get("/katakana", response_model=list[KanaItem])
def fetch_katakana_kana(
	token: str = Depends(get_auth_token),
):
	return _fetch_kana("katakana")