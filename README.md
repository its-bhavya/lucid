# Lucid

Full-stack application with a React frontend and FastAPI backend.

## Backend

```bash
cd backend
pip install -r requirements.txt
cp .env.example .env   # fill in your API keys
uvicorn main:app --reload
```

Runs on http://localhost:8000. Verify with `GET /` — returns `{"message": "Lucid backend running"}`.

## Frontend

```bash
cd frontend
npm install
npm run dev
```

Runs on http://localhost:5173. Shows "Lucid frontend running".

## Environment Variables

Copy `backend/.env.example` to `backend/.env` and set:

- `EODHD_API_KEY` — your EODHD API key
- `GEMINI_API_KEY` — your Google Gemini API key
