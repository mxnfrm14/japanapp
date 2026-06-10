"""Pydantic models for AI chat endpoints."""

from typing import Literal

from pydantic import BaseModel, Field


class ChatMessage(BaseModel):
	"""Single message in a chat conversation."""

	role: Literal["system", "user", "assistant"]
	content: str


class ChatRequest(BaseModel):
	"""Chat completion request payload."""

	messages: list[ChatMessage] = Field(min_length=1)
	model: str | None = None
	temperature: float | None = Field(default=None, ge=0.0, le=2.0)
	max_tokens: int | None = Field(default=None, ge=1)
	system_prompt: str | None = None


class ChatResponse(BaseModel):
	"""Chat completion response payload."""

	reply: str
	model: str
