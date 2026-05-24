import base64
import hashlib
import hmac
import json
import time
from typing import Literal
from fastapi import Header, HTTPException, status
from app.core.config import get_settings

Role = Literal["registrar", "admin", "super_admin"]


def _b64(data: bytes) -> str:
    return base64.urlsafe_b64encode(data).decode().rstrip("=")


def _unb64(data: str) -> bytes:
    padding = "=" * (-len(data) % 4)
    return base64.urlsafe_b64decode(data + padding)


def create_token(role: Role) -> str:
    settings = get_settings()
    payload = {
        "role": role,
        "iat": int(time.time()),
        "exp": int(time.time()) + settings.TOKEN_TTL_SECONDS,
    }
    payload_b64 = _b64(json.dumps(payload, separators=(",", ":")).encode())
    signature = hmac.new(settings.SECRET_KEY.encode(), payload_b64.encode(), hashlib.sha256).digest()
    return f"{payload_b64}.{_b64(signature)}"


def verify_token(token: str) -> Role:
    settings = get_settings()
    try:
        payload_b64, signature_b64 = token.split(".", 1)
        expected = hmac.new(settings.SECRET_KEY.encode(), payload_b64.encode(), hashlib.sha256).digest()
        given = _unb64(signature_b64)
        if not hmac.compare_digest(expected, given):
            raise ValueError("Invalid signature")
        payload = json.loads(_unb64(payload_b64))
        if int(payload.get("exp", 0)) < int(time.time()):
            raise ValueError("Token expired")
        role = payload.get("role")
        if role not in ("registrar", "admin", "super_admin"):
            raise ValueError("Invalid role")
        return role
    except Exception:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid or expired session")


def get_current_role(authorization: str | None = Header(default=None)) -> Role:
    if not authorization or not authorization.lower().startswith("bearer "):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Missing bearer token")
    token = authorization.split(" ", 1)[1].strip()
    return verify_token(token)


def require_registrar_or_admin(role: Role = None) -> Role:
    return role


def require_admin(authorization: str | None = Header(default=None)) -> Role:
    role = get_current_role(authorization)
    if role not in ("admin", "super_admin"):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Admin access required")
    return role


def require_registrar(authorization: str | None = Header(default=None)) -> Role:
    role = get_current_role(authorization)
    if role not in ("registrar", "admin", "super_admin"):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Registrar access required")
    return role
