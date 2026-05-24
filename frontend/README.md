# Frontend - Community Gaming Verification

React + Vite + Tailwind mobile-first interface for outdoor registrar/admin operations.

## Local setup

```bash
cd frontend
npm install
cp .env.example .env
npm run dev
```

Edit `.env`:

```text
VITE_API_BASE_URL=http://localhost:8000
```

## Render static site

Build command:

```bash
npm install && npm run build
```

Publish directory:

```text
dist
```

Set environment variable:

```text
VITE_API_BASE_URL=https://your-backend.onrender.com
```
