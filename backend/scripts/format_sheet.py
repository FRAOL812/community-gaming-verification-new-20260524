from __future__ import annotations

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.core.config import get_settings
from app.services.sheets_service import HEADERS, SheetsService


def _find_sheet_id(metadata: dict, title: str) -> int:
    for sheet in metadata.get("sheets", []):
        props = sheet.get("properties", {})
        if props.get("title") == title:
            return int(props["sheetId"])
    raise RuntimeError(f"Tab '{title}' was not found in the spreadsheet. Create it first and retry.")


def format_sheet() -> None:
    settings = get_settings()
    sheets = SheetsService()
    sheet_api = sheets.service.spreadsheets()

    metadata = sheet_api.get(
        spreadsheetId=settings.SHEET_ID,
        includeGridData=False,
    ).execute()
    sheet_id = _find_sheet_id(metadata, settings.SHEET_TAB)

    column_widths = [
        190,  # Timestamp
        200,  # Full Name
        240,  # Email
        170,  # Phone Number
        180,  # YouTube Handle
        220,  # Channel ID
        230,  # Channel Title
        170,  # Verification Status
        130,  # Exit Level
        140,  # Result Status
        120,  # Winnings
        190,  # Telebirr Ref
        190,  # Updated At
    ]

    requests: list[dict] = [
        {
            "updateSheetProperties": {
                "properties": {
                    "sheetId": sheet_id,
                    "gridProperties": {"frozenRowCount": 1},
                },
                "fields": "gridProperties.frozenRowCount",
            }
        },
        {
            "repeatCell": {
                "range": {
                    "sheetId": sheet_id,
                    "startRowIndex": 0,
                    "endRowIndex": 1,
                    "startColumnIndex": 0,
                    "endColumnIndex": len(HEADERS),
                },
                "cell": {
                    "userEnteredFormat": {
                        "backgroundColor": {"red": 0.07, "green": 0.2, "blue": 0.35},
                        "textFormat": {
                            "bold": True,
                            "foregroundColor": {"red": 1, "green": 1, "blue": 1},
                            "fontSize": 11,
                        },
                        "horizontalAlignment": "CENTER",
                        "verticalAlignment": "MIDDLE",
                        "wrapStrategy": "WRAP",
                    }
                },
                "fields": "userEnteredFormat(backgroundColor,textFormat,horizontalAlignment,verticalAlignment,wrapStrategy)",
            }
        },
        {
            "repeatCell": {
                "range": {
                    "sheetId": sheet_id,
                    "startRowIndex": 1,
                    "startColumnIndex": 0,
                    "endColumnIndex": len(HEADERS),
                },
                "cell": {
                    "userEnteredFormat": {
                        "horizontalAlignment": "LEFT",
                        "verticalAlignment": "MIDDLE",
                        "wrapStrategy": "WRAP",
                    }
                },
                "fields": "userEnteredFormat(horizontalAlignment,verticalAlignment,wrapStrategy)",
            }
        },
        {
            "setBasicFilter": {
                "filter": {
                    "range": {
                        "sheetId": sheet_id,
                        "startRowIndex": 0,
                        "startColumnIndex": 0,
                        "endColumnIndex": len(HEADERS),
                    }
                }
            }
        },
        {
            "repeatCell": {
                "range": {
                    "sheetId": sheet_id,
                    "startRowIndex": 1,
                    "startColumnIndex": 10,
                    "endColumnIndex": 11,
                },
                "cell": {
                    "userEnteredFormat": {
                        "numberFormat": {"type": "NUMBER", "pattern": "#,##0"},
                        "horizontalAlignment": "RIGHT",
                    }
                },
                "fields": "userEnteredFormat(numberFormat,horizontalAlignment)",
            }
        },
    ]

    for col_index, pixel_size in enumerate(column_widths):
        requests.append(
            {
                "updateDimensionProperties": {
                    "range": {
                        "sheetId": sheet_id,
                        "dimension": "COLUMNS",
                        "startIndex": col_index,
                        "endIndex": col_index + 1,
                    },
                    "properties": {"pixelSize": pixel_size},
                    "fields": "pixelSize",
                }
            }
        )

    sheet_api.batchUpdate(
        spreadsheetId=settings.SHEET_ID,
        body={"requests": requests},
    ).execute()

    print(f"Sheet formatted successfully: {settings.SHEET_TAB} ({settings.SHEET_ID})")


if __name__ == "__main__":
    format_sheet()
