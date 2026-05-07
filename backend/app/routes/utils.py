"""Shared helper functions for route modules."""
from typing import Any, Optional

from fastapi import HTTPException, Header, status

from app.services.services import supabase_auth_request


def _get_token_from_header(authorization: Optional[str]) -> str:
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="Missing bearer token"
        )
    return authorization.removeprefix("Bearer ").strip()


def _get_error_detail(response) -> str:
    try:
        body = response.json()
    except Exception:
        return "Request failed"
    return body.get("error_description") or body.get("msg") or body.get("error") or "Request failed"


def get_current_user(authorization: Optional[str] = Header(default=None)) -> dict[str, Any]:
    """Validate bearer token via Supabase and return authenticated user.
    
    Use as a dependency: @router.get(...) def endpoint(user: dict = Depends(get_current_user))
    """
    token = _get_token_from_header(authorization)
    response = supabase_auth_request("GET", "/auth/v1/user", token=token)
    
    if response.status_code >= 400:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid or expired token")
    
    return response.json()


def get_auth_token(authorization: Optional[str] = Header(default=None)) -> str:
    """Extract and validate bearer token.
    
    Use as a dependency when you need the token for data access:
    @router.get(...) def endpoint(token: str = Depends(get_auth_token))
    """
    token = _get_token_from_header(authorization)
    # Validate by fetching user info
    response = supabase_auth_request("GET", "/auth/v1/user", token=token)
    
    if response.status_code >= 400:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid or expired token")
    
    return token
