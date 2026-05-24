from fastapi import APIRouter, Depends, HTTPException, status
from app.core.security import require_registrar
from app.models import RegisterRequest, RegisterResponse, VerifyRequest, VerifyResponse
from app.services.player_store_service import get_player_store
from app.services.sheets_service import normalize_handle
from app.services.youtube_service import YouTubeService

router = APIRouter(prefix="/api/registrar", tags=["registrar"])


@router.post("/verify", response_model=VerifyResponse)
def verify_user(payload: VerifyRequest, _role=Depends(require_registrar)):
    youtube = YouTubeService()
    player_store, using_local_store = get_player_store()
    channel = youtube.find_channel_by_handle(payload.youtube_handle)
    normalized = normalize_handle(payload.youtube_handle)

    if not channel:
        return VerifyResponse(
            status="not_found",
            color="red",
            message="Account Not Found",
            youtube_handle=normalized,
        )

    row_number, _row = player_store.find_by_handle(normalized)
    if row_number:
        return VerifyResponse(
            status="already_played",
            color="yellow",
            message="Already Played",
            youtube_handle=normalized,
            channel_id=channel.get("channel_id"),
            channel_title=channel.get("channel_title"),
            sheet_row=row_number,
        )

    return VerifyResponse(
        status="ready",
        color="green",
        message="Ready (Local test mode)" if using_local_store else "Ready",
        youtube_handle=normalized,
        channel_id=channel.get("channel_id"),
        channel_title=channel.get("channel_title"),
    )


@router.post("/register", response_model=RegisterResponse)
def register_player(payload: RegisterRequest, _role=Depends(require_registrar)):
    youtube = YouTubeService()
    player_store, using_local_store = get_player_store()
    normalized = normalize_handle(payload.youtube_handle)

    channel = youtube.find_channel_by_handle(normalized)
    if not channel:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="YouTube account not found")

    row_number, _row = player_store.find_by_handle(normalized)
    if row_number:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="This YouTube handle has already played")

    player = player_store.append_player({
        "full_name": payload.full_name,
        "email": payload.email,
        "phone_number": payload.phone_number,
        "youtube_handle": normalized,
        "channel_id": channel.get("channel_id") or payload.channel_id or "",
        "channel_title": channel.get("channel_title") or payload.channel_title or "",
    })
    return RegisterResponse(
        ok=True,
        message="Player registered locally (Sheet not configured)" if using_local_store else "Player registered successfully",
        player=player,
    )
