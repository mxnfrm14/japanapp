"""Kana routes for JapanApp FastAPI Backend"""

from fastapi import APIRouter, HTTPException, Depends

from app.models.kana import KanaItem
from app.services.services import supabase_auth_request
from app.routes.utils import _get_error_detail, get_auth_token

kana_router = APIRouter(prefix="/kana", tags=["kana"])


def _fetch_kana(token: str, script_type: str | None = None) -> list[KanaItem]:
	path = "/rest/v1/kana_item?select=id,script_type,character,romaji,group_name,stroke_count,order_index,created_at&order=script_type.asc,order_index.asc"
	if script_type:
		path += f"&script_type=eq.{script_type}"

	response = supabase_auth_request("GET", path, token=token)

	if response.status_code >= 400:
		raise HTTPException(status_code=response.status_code, detail=_get_error_detail(response))

	return response.json()


@kana_router.get("", response_model=list[KanaItem])
def fetch_kana(
	token: str = Depends(get_auth_token),
):
	return _fetch_kana(token)


@kana_router.get("/hiragana", response_model=list[KanaItem])
def fetch_hiragana_kana(
	token: str = Depends(get_auth_token),
):
	return _fetch_kana(token, "hiragana")


@kana_router.get("/katakana", response_model=list[KanaItem])
def fetch_katakana_kana(
	token: str = Depends(get_auth_token),
):
	return _fetch_kana(token, "katakana")