"""Auth dependency helpers for JapanApp FastAPI Backend."""

from typing import Any, Optional

from fastapi import HTTPException, Header, status

from app.services.auth import get_authenticated_user
from app.services.services import supabase_auth_request


def _get_token_from_header(authorization: Optional[str]) -> str:
	if not authorization or not authorization.startswith("Bearer "):
		raise HTTPException(
			status_code=status.HTTP_401_UNAUTHORIZED,
			detail="Missing bearer token",
		)
	return authorization.removeprefix("Bearer ").strip()


def get_current_user(authorization: Optional[str] = Header(default=None)) -> dict[str, Any]:
	"""Validate bearer token and return authenticated user + profile."""
	token = _get_token_from_header(authorization)
	return get_authenticated_user(token)


def get_auth_token(authorization: Optional[str] = Header(default=None)) -> str:
	"""Validate bearer token and return the raw token for DB reads."""
	token = _get_token_from_header(authorization)
	response = supabase_auth_request("GET", "/auth/v1/user", token=token)

	if response.status_code >= 400:
		raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid or expired token")

	return token