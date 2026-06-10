"""AI chat routes for JapanApp FastAPI Backend."""

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import StreamingResponse

from app.dependencies.auth import get_auth_token
from app.models.ai import ChatRequest, ChatResponse
from app.services.ai import generate_chat_reply, stream_chat_reply


ai_router = APIRouter(prefix="/ai", tags=["ai"])


@ai_router.post("/chat", response_model=ChatResponse)
def chat(payload: ChatRequest, _token: str = Depends(get_auth_token)):
	"""Generate a reply for a chat conversation."""
	messages = [message.model_dump() for message in payload.messages]
	if payload.system_prompt:
		messages = [{"role": "system", "content": payload.system_prompt}] + messages

	try:
		result = generate_chat_reply(
			messages=messages,
			model=payload.model,
			temperature=payload.temperature,
			max_tokens=payload.max_tokens,
		)
	except RuntimeError as exc:
		raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail=str(exc)) from exc

	return ChatResponse(**result)


@ai_router.post("/chat/stream")
def chat_stream(payload: ChatRequest, _token: str = Depends(get_auth_token)):
	"""Stream a reply for a chat conversation."""
	messages = [message.model_dump() for message in payload.messages]
	if payload.system_prompt:
		messages = [{"role": "system", "content": payload.system_prompt}] + messages

	def stream_text():
		iterator = stream_chat_reply(
			messages=messages,
			model=payload.model,
			temperature=payload.temperature,
			max_tokens=payload.max_tokens,
		)
		try:
			first_chunk = next(iterator)
		except StopIteration:
			raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail="AI service returned an empty response")
		except RuntimeError as exc:
			raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail=str(exc)) from exc

		yield first_chunk
		yield from iterator

	return StreamingResponse(stream_text(), media_type="text/plain; charset=utf-8")
