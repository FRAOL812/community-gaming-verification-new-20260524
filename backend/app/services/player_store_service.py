from fastapi import HTTPException

from app.services.local_store_service import LocalStoreService
from app.services.sheets_service import SheetsService


def _should_use_local_fallback(exc: HTTPException) -> bool:
    detail = str(exc.detail).lower()
    fallback_markers = (
        "sheet_id is not configured",
        "service account file not found",
        "google_credentials_json is not valid json",
    )
    return any(marker in detail for marker in fallback_markers)


def get_player_store():
    try:
        return SheetsService(), False
    except HTTPException as exc:
        if exc.status_code >= 500 and _should_use_local_fallback(exc):
            return LocalStoreService(), True
        raise
