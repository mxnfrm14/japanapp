"""Routes for JapanApp FastAPI Backend"""

from typing import Any, Optional

from fastapi import APIRouter, HTTPException, Header, status
from pydantic import BaseModel

from app.services.services import supabase_admin_request, supabase_auth_request


router = APIRouter(prefix="/auth", tags=["auth"])


class LoginRequest(BaseModel):
	email: str
	password: str


class SignUpRequest(BaseModel):
	email: str
	password: str


def _serialize_supabase_response(data: Any) -> Any:
	if data is None:
		return None
	if hasattr(data, "model_dump"):
		return data.model_dump()
	if hasattr(data, "dict"):
		return data.dict()
	return data


def _get_token_from_header(authorization: Optional[str]) -> str:
	if not authorization or not authorization.startswith("Bearer "):
		raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Missing bearer token")
	return authorization.removeprefix("Bearer ").strip()


def _get_error_detail(response) -> str:
	body = response.json()
	return body.get("error_description") or body.get("msg") or body.get("error") or "Request failed"


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
def me(authorization: Optional[str] = Header(default=None)):
	token = _get_token_from_header(authorization)
	response = supabase_auth_request("GET", "/auth/v1/user", token=token)

	if response.status_code >= 400:
		raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid or expired token")

	return {"user": response.json()}

@router.post("/logout")
def logout():
	return {"success": True}