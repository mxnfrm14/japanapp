"""Services for JapanApp FastAPI Backend"""

from typing import Any, Optional

import httpx

from app.config import settings


def get_supabase_auth_headers() -> dict[str, str]:
	return {
		"apikey": settings.supabase_key,
		"Content-Type": "application/json",
	}


def get_supabase_admin_headers() -> dict[str, str]:
	return {
		"apikey": settings.supabase_service_key,
		"Authorization": f"Bearer {settings.supabase_service_key}",
		"Content-Type": "application/json",
	}


def supabase_auth_request(method: str, path: str, payload: Optional[dict[str, Any]] = None, token: Optional[str] = None) -> httpx.Response:
	headers = get_supabase_auth_headers()
	if token:
		headers["Authorization"] = f"Bearer {token}"

	with httpx.Client(base_url=settings.supabase_url.rstrip("/"), timeout=30.0) as client:
		return client.request(method, path, headers=headers, json=payload)


def supabase_admin_request(method: str, path: str, payload: Optional[dict[str, Any]] = None) -> httpx.Response:
	with httpx.Client(base_url=settings.supabase_url.rstrip("/"), timeout=30.0) as client:
		return client.request(method, path, headers=get_supabase_admin_headers(), json=payload)