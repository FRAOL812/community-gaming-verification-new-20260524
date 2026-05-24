import json
import os
from datetime import datetime, timezone
from typing import Any

from fastapi import HTTPException

from app.core.config import get_settings
from app.models import Player
from app.services.sheets_service import normalize_handle


class LocalStoreService:
    def __init__(self) -> None:
        self.settings = get_settings()
        self.path = self.settings.LOCAL_STORE_FILE
        if not os.path.isabs(self.path):
            self.path = os.path.join(os.getcwd(), self.path)
        self._ensure_file()

    def _ensure_file(self) -> None:
        if os.path.exists(self.path):
            return
        with open(self.path, "w", encoding="utf-8") as f:
            json.dump([], f)

    def _read_rows(self) -> list[dict[str, Any]]:
        self._ensure_file()
        try:
            with open(self.path, "r", encoding="utf-8") as f:
                data = json.load(f)
            if isinstance(data, list):
                return [row for row in data if isinstance(row, dict)]
            return []
        except (OSError, json.JSONDecodeError):
            return []

    def _write_rows(self, rows: list[dict[str, Any]]) -> None:
        with open(self.path, "w", encoding="utf-8") as f:
            json.dump(rows, f, ensure_ascii=True, indent=2)

    def _to_player(self, row: dict[str, Any], default_row_number: int) -> Player:
        row_number = int(row.get("row_number", default_row_number))
        return Player(
            row_number=row_number,
            timestamp=str(row.get("timestamp", "")),
            full_name=str(row.get("full_name", "")),
            email=str(row.get("email", "")),
            phone_number=str(row.get("phone_number", "")),
            youtube_handle=str(row.get("youtube_handle", "")),
            channel_id=str(row.get("channel_id", "")),
            channel_title=str(row.get("channel_title", "")),
            verification_status=str(row.get("verification_status", "")),
            exit_level=str(row.get("exit_level", "")),
            result_status=str(row.get("result_status", "")),
            winnings=str(row.get("winnings", "")),
            telebirr_ref=str(row.get("telebirr_ref", "")),
            updated_at=str(row.get("updated_at", "")),
        )

    def find_by_handle(self, handle: str) -> tuple[int | None, dict[str, Any] | None]:
        target = normalize_handle(handle)
        for index, row in enumerate(self._read_rows(), start=2):
            row_handle = normalize_handle(str(row.get("youtube_handle", "")))
            row_number = int(row.get("row_number", index))
            if row_handle == target:
                return row_number, row
        return None, None

    def list_players(self) -> list[Player]:
        players: list[Player] = []
        for index, row in enumerate(self._read_rows(), start=2):
            player = self._to_player(row, index)
            if any(
                str(value).strip()
                for value in (
                    player.full_name,
                    player.email,
                    player.phone_number,
                    player.youtube_handle,
                )
            ):
                players.append(player)
        return players

    def append_player(self, data: dict[str, Any]) -> Player:
        rows = self._read_rows()
        now = datetime.now(timezone.utc).isoformat(timespec="seconds")
        next_row_number = max([1] + [int(row.get("row_number", 1)) for row in rows]) + 1
        if next_row_number < 2:
            next_row_number = 2

        row = {
            "row_number": next_row_number,
            "timestamp": now,
            "full_name": str(data.get("full_name", "")).strip(),
            "email": str(data.get("email", "")).strip(),
            "phone_number": str(data.get("phone_number", "")).strip(),
            "youtube_handle": normalize_handle(str(data.get("youtube_handle", ""))),
            "channel_id": str(data.get("channel_id", "") or ""),
            "channel_title": str(data.get("channel_title", "") or ""),
            "verification_status": "PENDING",
            "exit_level": "",
            "result_status": "",
            "winnings": "",
            "telebirr_ref": "",
            "updated_at": now,
        }
        rows.append(row)
        self._write_rows(rows)
        return self._to_player(row, next_row_number)

    def update_result(self, row_number: int, exit_level: str, result_status: str, winnings: int, telebirr_ref: str) -> None:
        rows = self._read_rows()
        found = False
        now = datetime.now(timezone.utc).isoformat(timespec="seconds")

        for row in rows:
            if int(row.get("row_number", -1)) == row_number:
                row["exit_level"] = exit_level
                row["result_status"] = result_status
                row["winnings"] = str(winnings)
                row["telebirr_ref"] = telebirr_ref.strip()
                row["updated_at"] = now
                found = True
                break

        if not found:
            raise HTTPException(status_code=404, detail="Player row not found")

        self._write_rows(rows)

    def update_verification_status(self, row_number: int, verification_status: str) -> None:
        rows = self._read_rows()
        found = False
        now = datetime.now(timezone.utc).isoformat(timespec="seconds")

        for row in rows:
            if int(row.get("row_number", -1)) == row_number:
                row["verification_status"] = verification_status.strip()
                row["updated_at"] = now
                found = True
                break

        if not found:
            raise HTTPException(status_code=404, detail="Player row not found")

        self._write_rows(rows)
