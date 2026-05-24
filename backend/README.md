# Backend - Community Gaming Verification API

FastAPI backend for registrar verification, registration, admin player list, and payout logging.

## Local setup

```bash
cd backend
python -m venv .venv
source .venv/bin/activate  # Windows: .venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env
```

Add your Google service account file as:

```text
backend/credentials.json
```

Then edit `.env` with:

```text
YT_API_KEY=...
SHEET_ID=...
SUPER_ADMIN_PASSWORD=SUPER_ADMIN_2026
```

Share the Google Sheet with the service account email from `credentials.json`.

## Google Sheet columns

The API automatically writes this header to the `Players` tab:

```text
Timestamp | Full Name | Email | Phone Number | YouTube Handle | Channel ID | Channel Title | Verification Status | Exit Level | Result Status | Winnings | Telebirr Ref | Updated At
```

## Run

```bash
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

Health check:

```text
GET /api/health
```

Optional one-time professional sheet formatting (header style, frozen row, column widths, filter):

```bash
python scripts/format_sheet.py
```

## Render backend command

Build command:

```bash
pip install -r requirements.txt
```

Start command:

```bash
uvicorn app.main:app --host 0.0.0.0 --port $PORT
```

For Render, set `GOOGLE_CREDENTIALS_JSON` instead of uploading `credentials.json`.

## Edit-lock rule

- First admin update on result/status is allowed.
- Any further edit on that same result/status row requires `super_admin` login.
