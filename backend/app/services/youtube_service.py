from fastapi import HTTPException
from googleapiclient.discovery import build
from googleapiclient.errors import HttpError
from app.core.config import get_settings
from app.services.sheets_service import normalize_handle


class YouTubeService:
    def __init__(self) -> None:
        self.settings = get_settings()
        if not self.settings.YT_API_KEY:
            raise HTTPException(status_code=500, detail="YT_API_KEY is not configured")
        self.youtube = build("youtube", "v3", developerKey=self.settings.YT_API_KEY, cache_discovery=False)

    def find_channel_by_handle(self, handle: str) -> dict | None:
        normalized = normalize_handle(handle)
        if not normalized:
            return None

        # Primary lookup: YouTube handles such as @example
        try:
            response = self.youtube.channels().list(
                part="snippet",
                forHandle=normalized,
                maxResults=1,
            ).execute()
            items = response.get("items", [])
            if items:
                item = items[0]
                return {
                    "channel_id": item.get("id", ""),
                    "channel_title": item.get("snippet", {}).get("title", ""),
                    "handle": normalized,
                }
        except TypeError:
            # Older generated clients may not include forHandle. Fall back below.
            pass
        except HttpError as exc:
            # Fall back to search for 400/404 style lookup issues; fail for quota/auth errors.
            if exc.resp.status not in (400, 404):
                raise HTTPException(status_code=502, detail=f"YouTube lookup failed: {exc}")

        # Fallback: search by the visible handle text.
        try:
            response = self.youtube.search().list(
                part="snippet",
                q=normalized,
                type="channel",
                maxResults=1,
            ).execute()
            items = response.get("items", [])
            if not items:
                return None
            item = items[0]
            channel_id = item.get("snippet", {}).get("channelId") or item.get("id", {}).get("channelId", "")
            return {
                "channel_id": channel_id,
                "channel_title": item.get("snippet", {}).get("title", ""),
                "handle": normalized,
            }
        except HttpError as exc:
            raise HTTPException(status_code=502, detail=f"YouTube lookup failed: {exc}")
