import json
import os
import tempfile
from datetime import datetime, timezone
from typing import Any
from fastapi import HTTPException, status
from app.core.config import get_settings
from app.models import Player

SCOPES = ["https://www.googleapis.com/auth/spreadsheets"]
HEADERS = [
    "Timestamp",
    "Full Name",
    "Email",
    "Phone Number",
    "YouTube Handle",
    "Channel ID",
    "Channel Title",
    "Verification Status",
    "Exit Level",
    "Result Status",
    "Winnings",
    "Telebirr Ref",
    "Updated At",
]


def normalize_handle(handle: str) -> str:
    cleaned = handle.strip()
    if not cleaned:
        return ""
    cleaned = cleaned.replace("https://www.youtube.com/", "")
    cleaned = cleaned.replace("https://youtube.com/", "")
    cleaned = cleaned.replace("youtube.com/", "")
    cleaned = cleaned.replace("channel/", "") if cleaned.startswith("channel/") else cleaned
    cleaned = cleaned.split("?")[0].strip().strip("/")
    if cleaned.startswith("@"): 
        return cleaned.lower()
    if cleaned.startswith("handle/"):
        cleaned = cleaned.replace("handle/", "", 1)
    return f"@{cleaned}".lower()


class SheetsService:
    def __init__(self) -> None:
        self.settings = get_settings()
        if not self.settings.SHEET_ID:
            raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="SHEET_ID is not configured")
        self.service = self._build_service()
        self.sheet = self.service.spreadsheets()
        self.ensure_headers()

    def _credentials_file(self) -> str:
        if self.settings.GOOGLE_CREDENTIALS_JSON:
            try:
                parsed = json.loads(self.settings.GOOGLE_CREDENTIALS_JSON)
                temp = tempfile.NamedTemporaryFile(mode="w", suffix=".json", delete=False)
                json.dump(parsed, temp)
                temp.flush()
                temp.close()
                return temp.name
            except json.JSONDecodeError:
                raise HTTPException(status_code=500, detail="GOOGLE_CREDENTIALS_JSON is not valid JSON")

        path = self.settings.SERVICE_ACCOUNT_FILE
        if not os.path.isabs(path):
            path = os.path.join(os.getcwd(), path)
        if not os.path.exists(path):
            raise HTTPException(status_code=500, detail=f"Service account file not found: {path}")
        return path

    def _build_service(self):
        try:
            from google.oauth2 import service_account
            from googleapiclient.discovery import build
        except Exception as exc:
            raise HTTPException(status_code=500, detail=f"Google Sheets client not available: {exc}")

        try:
            credentials = service_account.Credentials.from_service_account_file(
                self._credentials_file(), scopes=SCOPES
            )
            return build("sheets", "v4", credentials=credentials, cache_discovery=False)
        except HTTPException:
            raise
        except Exception as exc:
            raise HTTPException(status_code=500, detail=f"Google Sheets client initialization failed: {exc}")

    def _range(self, a1: str) -> str:
        return f"{self.settings.SHEET_TAB}!{a1}"

    def ensure_headers(self) -> None:
        try:
            result = self.sheet.values().get(
                spreadsheetId=self.settings.SHEET_ID,
                range=self._range("A1:M1"),
            ).execute()
            values = result.get("values", [])
            if not values or values[0] != HEADERS:
                self.sheet.values().update(
                    spreadsheetId=self.settings.SHEET_ID,
                    range=self._range("A1:M1"),
                    valueInputOption="RAW",
                    body={"values": [HEADERS]},
                ).execute()
        except Exception as exc:
            raise HTTPException(status_code=500, detail=f"Google Sheets header setup failed: {exc}")

    def get_rows(self) -> list[list[str]]:
        try:
            result = self.sheet.values().get(
                spreadsheetId=self.settings.SHEET_ID,
                range=self._range("A2:M"),
            ).execute()
            return result.get("values", [])
        except Exception as exc:
            raise HTTPException(status_code=500, detail=f"Google Sheets read failed: {exc}")

    def find_by_handle(self, handle: str) -> tuple[int | None, list[str] | None]:
        target = normalize_handle(handle)
        for index, row in enumerate(self.get_rows(), start=2):
            row_handle = normalize_handle(row[4] if len(row) > 4 else "")
            if row_handle == target:
                return index, row
        return None, None

    def _row_to_player(self, row_number: int, row: list[str]) -> Player:
        padded = row + [""] * (len(HEADERS) - len(row))
        return Player(
            row_number=row_number,
            timestamp=padded[0],
            full_name=padded[1],
            email=padded[2],
            phone_number=padded[3],
            youtube_handle=padded[4],
            channel_id=padded[5],
            channel_title=padded[6],
            verification_status=padded[7],
            exit_level=padded[8],
            result_status=padded[9],
            winnings=padded[10],
            telebirr_ref=padded[11],
            updated_at=padded[12],
        )

    def list_players(self) -> list[Player]:
        players: list[Player] = []
        for index, row in enumerate(self.get_rows(), start=2):
            if any(str(cell).strip() for cell in row):
                players.append(self._row_to_player(index, row))
        return players

    def append_player(self, data: dict[str, Any]) -> Player:
        now = datetime.now(timezone.utc).isoformat(timespec="seconds")
        row = [
            now,
            data.get("full_name", "").strip(),
            data.get("email", "").strip(),
            data.get("phone_number", "").strip(),
            normalize_handle(data.get("youtube_handle", "")),
            data.get("channel_id", "") or "",
            data.get("channel_title", "") or "",
            "PENDING",
            "",
            "",
            "",
            "",
            now,
        ]
        try:
            self.sheet.values().append(
                spreadsheetId=self.settings.SHEET_ID,
                range=self._range("A:M"),
                valueInputOption="USER_ENTERED",
                insertDataOption="INSERT_ROWS",
                body={"values": [row]},
            ).execute()
            row_number, found = self.find_by_handle(row[4])
            if row_number and found:
                return self._row_to_player(row_number, found)
            return self._row_to_player(len(self.get_rows()) + 1, row)
        except Exception as exc:
            raise HTTPException(status_code=500, detail=f"Google Sheets append failed: {exc}")

    def update_result(self, row_number: int, exit_level: str, result_status: str, winnings: int, telebirr_ref: str) -> None:
        now = datetime.now(timezone.utc).isoformat(timespec="seconds")
        values = [[exit_level, result_status, str(winnings), telebirr_ref.strip(), now]]
        try:
            self.sheet.values().update(
                spreadsheetId=self.settings.SHEET_ID,
                range=self._range(f"I{row_number}:M{row_number}"),
                valueInputOption="USER_ENTERED",
                body={"values": values},
            ).execute()
        except Exception as exc:
            raise HTTPException(status_code=500, detail=f"Google Sheets update failed: {exc}")

    def update_verification_status(self, row_number: int, verification_status: str) -> None:
        now = datetime.now(timezone.utc).isoformat(timespec="seconds")
        try:
            self.sheet.values().update(
                spreadsheetId=self.settings.SHEET_ID,
                range=self._range(f"H{row_number}:H{row_number}"),
                valueInputOption="USER_ENTERED",
                body={"values": [[verification_status.strip()]]},
            ).execute()
            self.sheet.values().update(
                spreadsheetId=self.settings.SHEET_ID,
                range=self._range(f"M{row_number}:M{row_number}"),
                valueInputOption="USER_ENTERED",
                body={"values": [[now]]},
            ).execute()
        except Exception as exc:
            raise HTTPException(status_code=500, detail=f"Google Sheets status update failed: {exc}")
