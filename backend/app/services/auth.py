"""Auth service helpers for JapanApp FastAPI Backend."""

from typing import Any

from fastapi import HTTPException, status

from app.services.profile import fetch_profile
from app.services.services import supabase_admin_request, supabase_auth_request


def _get_error_detail(response) -> str:
	try:
		body = response.json()
	except Exception:
		return "Request failed"
	return body.get("error_description") or body.get("msg") or body.get("error") or "Request failed"


def login_with_email(email: str, password: str) -> dict[str, Any]:
	response = supabase_auth_request(
		"POST",
		"/auth/v1/token?grant_type=password",
		payload={"email": email.strip().lower(), "password": password},
	)

	if response.status_code >= 400:
		raise HTTPException(status_code=response.status_code, detail=_get_error_detail(response))

	data = response.json()
	return {"session": data, "user": data.get("user")}


def signup_with_email(email: str, password: str) -> dict[str, Any]:
	response = supabase_admin_request(
		"POST",
		"/auth/v1/admin/users",
		payload={"email": email.strip().lower(), "password": password, "email_confirm": True},
	)

	if response.status_code >= 400:
		raise HTTPException(status_code=response.status_code, detail=_get_error_detail(response))

	data = response.json()
	return {"session": None, "user": data.get("user") or data}


def get_authenticated_user(token: str) -> dict[str, Any]:
	response = supabase_auth_request("GET", "/auth/v1/user", token=token)

	if response.status_code >= 400:
		raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid or expired token")

	auth_user = response.json()
	user_id = auth_user.get("id")

	if not user_id:
		return auth_user

	profile = fetch_profile(user_id)
	if profile is None:
		return auth_user

	return {**auth_user, **profile}