from fastapi import APIRouter, HTTPException, status
from app.core.config import get_settings
from app.core.security import create_token
from app.models import LoginRequest, LoginResponse

router = APIRouter(prefix="/api/auth", tags=["auth"])


@router.post("/login", response_model=LoginResponse)
def login(payload: LoginRequest):
    settings = get_settings()
    if payload.role == "registrar" and payload.password == settings.REGISTRAR_PASSWORD:
        return LoginResponse(token=create_token("registrar"), role="registrar")
    if payload.role == "admin" and payload.password == settings.ADMIN_PASSWORD:
        return LoginResponse(token=create_token("admin"), role="admin")
    if payload.role == "super_admin" and payload.password == settings.SUPER_ADMIN_PASSWORD:
        return LoginResponse(token=create_token("super_admin"), role="super_admin")
    raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid password")
