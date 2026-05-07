"""Shared helper functions for route modules."""


def _get_error_detail(response) -> str:
    try:
        body = response.json()
    except Exception:
        return "Request failed"
    return body.get("error_description") or body.get("msg") or body.get("error") or "Request failed"
