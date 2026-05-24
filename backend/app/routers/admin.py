from fastapi import APIRouter, Depends, HTTPException
from app.core.config import get_settings
from app.core.security import Role, require_admin
from app.models import Player, ResultRequest, ResultResponse, StatusUpdateRequest, StatusUpdateResponse
from app.services.player_store_service import get_player_store

router = APIRouter(prefix="/api/admin", tags=["admin"])

def _normalize_result_status(value: str) -> str:
    normalized = value.strip()
    lowered = normalized.lower()
    if lowered == "won":
        return "Won"
    if lowered in ("fell", "failed"):
        return "Failed"
    return normalized


def _get_player_by_row(players: list[Player], row_number: int) -> Player:
    for player in players:
        if player.row_number == row_number:
            return player
    raise HTTPException(status_code=404, detail="Player row not found")


def _result_edit_requires_super_admin(player: Player, next_exit_level: str, next_status: str, next_winnings: int, next_telebirr_ref: str) -> bool:
    existing_values = (
        player.exit_level.strip(),
        _normalize_result_status(player.result_status),
        player.winnings.strip(),
        player.telebirr_ref.strip(),
    )
    has_existing_result = any(existing_values)
    if not has_existing_result:
        return False
    next_values = (
        next_exit_level.strip(),
        _normalize_result_status(next_status),
        str(next_winnings).strip(),
        next_telebirr_ref.strip(),
    )
    return next_values != existing_values


def _status_edit_requires_super_admin(player: Player, next_status: str) -> bool:
    current_status = player.verification_status.strip()
    if not current_status or current_status.lower() in ("ready", "pending"):
        return False
    return current_status != next_status.strip()


def _assert_super_admin_for_edit_lock(role: Role, message: str) -> None:
    if role != "super_admin":
        raise HTTPException(status_code=403, detail=message)


@router.get("/players", response_model=list[Player])
def list_players(_role=Depends(require_admin)):
    player_store, _using_local_store = get_player_store()
    return player_store.list_players()


@router.post("/players/{row_number}/result", response_model=ResultResponse)
def log_result(row_number: int, payload: ResultRequest, role: Role = Depends(require_admin)):
    if row_number < 2:
        raise HTTPException(status_code=400, detail="Invalid sheet row number")

    settings = get_settings()
    player_store, using_local_store = get_player_store()
    players = player_store.list_players()
    current_player = _get_player_by_row(players, row_number)
    if current_player.verification_status.strip().lower() == "pending":
        raise HTTPException(status_code=400, detail="Player is still pending. Update status before logging result.")

    normalized_status = _normalize_result_status(payload.status)
    if normalized_status == "Won":
        winnings = settings.payout_map.get(payload.exit_level, 0)
    else:
        winnings = 0

    next_telebirr_ref = payload.telebirr_ref.strip() if normalized_status == "Won" else ""

    if _result_edit_requires_super_admin(
        current_player,
        payload.exit_level,
        normalized_status,
        winnings,
        next_telebirr_ref,
    ):
        _assert_super_admin_for_edit_lock(
            role,
            "Result already updated. Super admin privilege is required for further edits.",
        )

    player_store.update_result(
        row_number=row_number,
        exit_level=payload.exit_level,
        result_status=normalized_status,
        winnings=winnings,
        telebirr_ref=next_telebirr_ref,
    )
    return ResultResponse(
        ok=True,
        message="Result logged locally (Sheet not configured)" if using_local_store else "Result logged successfully",
        row_number=row_number,
        winnings=winnings,
    )


@router.post("/players/{row_number}/status", response_model=StatusUpdateResponse)
def update_player_status(row_number: int, payload: StatusUpdateRequest, role: Role = Depends(require_admin)):
    if row_number < 2:
        raise HTTPException(status_code=400, detail="Invalid sheet row number")

    verification_status = payload.verification_status.strip()
    if not verification_status:
        raise HTTPException(status_code=400, detail="Verification status is required")

    player_store, using_local_store = get_player_store()
    players = player_store.list_players()
    current_player = _get_player_by_row(players, row_number)

    if _status_edit_requires_super_admin(current_player, verification_status):
        _assert_super_admin_for_edit_lock(
            role,
            "Status already updated. Super admin privilege is required for further edits.",
        )

    player_store.update_verification_status(row_number=row_number, verification_status=verification_status)

    return StatusUpdateResponse(
        ok=True,
        message="Status updated locally (Sheet not configured)" if using_local_store else "Status updated successfully",
        row_number=row_number,
        verification_status=verification_status,
    )
