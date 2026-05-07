"""Auth routes for JapanApp FastAPI Backend"""

from typing import Any, Optional

from fastapi import APIRouter, HTTPException, Header, status, Depends
from app.services.services import supabase_admin_request, supabase_auth_request
from app.models.auth import LoginRequest, SignUpRequest
from app.routes.utils import _get_error_detail, get_current_user


router = APIRouter(prefix="/auth", tags=["auth"])


def _serialize_supabase_response(data: Any) -> Any:
	if data is None:
		return None
	if hasattr(data, "model_dump"):
		return data.model_dump()
	if hasattr(data, "dict"):
		return data.dict()
	return data


@router.post("/login")
def login(payload: LoginRequest):
	email = payload.email.strip().lower()
	response = supabase_auth_request(
		"POST",
		"/auth/v1/token?grant_type=password",
		payload={"email": email, "password": payload.password},
	)

	if response.status_code >= 400:
		raise HTTPException(status_code=response.status_code, detail=_get_error_detail(response))

	data = response.json()

	return {
		"session": data,
		"user": data.get("user"),
	}


@router.post("/signup")
def signup(payload: SignUpRequest):
	email = payload.email.strip().lower()
	response = supabase_admin_request(
		"POST",
		"/auth/v1/admin/users",
		payload={"email": email, "password": payload.password, "email_confirm": True},
	)

	if response.status_code >= 400:
		raise HTTPException(status_code=response.status_code, detail=_get_error_detail(response))

	data = response.json()

	return {
		"session": None,
		"user": data.get("user") or data,
	}


@router.get("/me")
def me(user: dict = Depends(get_current_user)):
	return {"user": user}


@router.post("/logout")
def logout():
	return {"success": True}