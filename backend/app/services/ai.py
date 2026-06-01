"""AI chat service helpers."""

import json
from typing import Any, Iterator

import httpx

from app.config import settings


MISTRAL_CHAT_URL = "https://api.mistral.ai/v1/chat/completions"
DEFAULT_MISTRAL_MODEL = "mistral-large-latest"


def generate_chat_reply(
    messages: list[dict[str, str]],
    model: str | None = None,
    temperature: float | None = None,
    max_tokens: int | None = None,
) -> dict[str, Any]:
    """Return a buffered assistant reply for a chat conversation."""
    chunks = list(stream_chat_reply(messages=messages, model=model, temperature=temperature, max_tokens=max_tokens))
    reply = "".join(chunks).strip()
    if not reply:
        raise RuntimeError("AI service returned an empty response")

    return {
        "reply": reply,
        "model": model or DEFAULT_MISTRAL_MODEL,
    }


def stream_chat_reply(
    messages: list[dict[str, str]],
    model: str | None = None,
    temperature: float | None = None,
    max_tokens: int | None = None,
) -> Iterator[str]:
    """Yield assistant text chunks from the documented Mistral streaming API."""
    api_key = settings.mistral_api_key.strip()
    if not api_key:
        raise RuntimeError("MISTRAL_API_KEY is not configured")

    payload: dict[str, Any] = {
        "model": model or DEFAULT_MISTRAL_MODEL,
        "messages": messages,
        "stream": True,
    }

    if temperature is not None:
        payload["temperature"] = temperature
    if max_tokens is not None:
        payload["max_tokens"] = max_tokens

    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json",
    }

    try:
        with httpx.Client(timeout=60.0) as client:
            with client.stream("POST", MISTRAL_CHAT_URL, json=payload, headers=headers) as response:
                if response.status_code >= 400:
                    raise RuntimeError(_extract_error_message(response))

                for line in response.iter_lines():
                    if not line:
                        continue
                    if line.startswith("data: "):
                        data = line.removeprefix("data: ").strip()
                        if data == "[DONE]":
                            break

                        chunk = json.loads(data)
                        choices = chunk.get("choices") or []
                        if not choices:
                            continue

                        delta = choices[0].get("delta") or {}
                        content = delta.get("content")
                        if content:
                            yield content
    except httpx.RequestError as exc:
        raise RuntimeError("AI service is unreachable") from exc


def _extract_error_message(response: httpx.Response) -> str:
    try:
        body = response.json()
    except Exception:
        return "AI service request failed"

    if isinstance(body, dict):
        return body.get("message") or body.get("error") or body.get("detail") or "AI service request failed"

    return "AI service request failed"