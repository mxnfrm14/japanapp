"""Auth routes for JapanApp FastAPI Backend"""

from fastapi import APIRouter, Depends

from app.models.auth import LoginRequest, SignUpRequest
from app.dependencies.auth import get_current_user
from app.services.auth import login_with_email, signup_with_email


router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/login")
def login(payload: LoginRequest):
	return login_with_email(payload.email, payload.password)


@router.post("/signup")
def signup(payload: SignUpRequest):
	return signup_with_email(payload.email, payload.password)


@router.get("/me")
def me(user: dict = Depends(get_current_user)):
	return {"user": user}


@router.post("/logout")
def logout():
	return {"success": True}