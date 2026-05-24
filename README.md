# Community Gaming & Verification App

A full-stack street engagement web app for registrar verification, player registration, admin result logging, and Telebirr reference tracking.

## Stack

- Backend: FastAPI, Python, Google Sheets API, YouTube Data API
- Frontend: React, Vite, Tailwind CSS
- Database: One Google Sheet
- Deployment target: Render backend web service + Render static frontend

## Folder structure

```text
community-gaming-verification/
  backend/
    app/
      core/
      routers/
      services/
      main.py
      models.py
    .env.example
    requirements.txt
    README.md
  frontend/
    src/
      components/
      lib/
      pages/
      App.tsx
      main.tsx
      styles.css
    .env.example
    package.json
    README.md
```

## Main flow

1. Registrar logs in with `REG_PASS_2026`.
2. Registrar searches a YouTube handle.
3. Backend checks YouTube first.
4. Backend checks Google Sheets for duplicate player history.
5. UI shows:
   - RED: Account Not Found
   - YELLOW: Already Played
   - GREEN: Ready
6. Registrar registers only GREEN users.
7. Admin logs in with `ADMIN_OP_99`.
8. Admin sees live registered players and logs result, exit level, winnings, and Telebirr reference.
9. Super Admin logs in with `SUPER_ADMIN_2026` for locked second edits.

## Google Sheet setup

Create a Google Sheet with a tab named:

```text
Players
```

Share the sheet with your Google Cloud service account email.

The backend will create/update this header row:

```text
Timestamp | Full Name | Email | Phone Number | YouTube Handle | Channel ID | Channel Title | Verification Status | Exit Level | Result Status | Winnings | Telebirr Ref | Updated At
```

## Local run

### Backend

```bash
cd backend
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
copy .env.example .env
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

Place `credentials.json` inside `backend/` for local development.

### Frontend

```bash
cd frontend
npm install
copy .env.example .env
npm run dev
```

Open:

```text
http://localhost:5173
```

## Render deployment

### Backend Web Service

Root directory:

```text
backend
```

Build command:

```bash
pip install -r requirements.txt
```

Start command:

```bash
uvicorn app.main:app --host 0.0.0.0 --port $PORT
```

Environment variables:

```text
SECRET_KEY=replace-with-long-random-string
REGISTRAR_PASSWORD=REG_PASS_2026
ADMIN_PASSWORD=ADMIN_OP_99
SUPER_ADMIN_PASSWORD=SUPER_ADMIN_2026
YT_API_KEY=your-youtube-api-key
SHEET_ID=1_rP5g4yHA56AMf7qHCoxSFmN5Ba2kIlpMSBHCiWaaJs
SHEET_TAB=Players
GOOGLE_CREDENTIALS_JSON={paste-full-service-account-json-here}
CORS_ORIGINS=https://cgv-frontend-20260524.onrender.com
FRONTEND_URL=https://cgv-frontend-20260524.onrender.com
PAYOUT_LEVEL_1=100
PAYOUT_LEVEL_2=500
PAYOUT_LEVEL_3=1500
PAYOUT_LEVEL_4=5000
PAYOUT_LEVEL_5=10000
PAYOUT_LEVEL_6=25000
PAYOUT_LEVEL_7=50000
PAYOUT_LEVEL_8=100000
PAYOUT_LEVEL_9=1000000
```

### Frontend Static Site

Root directory:

```text
frontend
```

Build command:

```bash
npm install && npm run build
```

Publish directory:

```text
dist
```

Environment variable:

```text
VITE_API_BASE_URL=https://your-backend.onrender.com
```
