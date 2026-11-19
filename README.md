# Mini Task Manager

An AI-agent-built task management application.

## Tech Stack

- Backend: FastAPI
- Frontend: React
- Database: SQLite

## Features

- Create tasks
- List tasks
- Update task status
- Delete tasks

## Development

### Backend

```bash
cd backend
python -m venv .venv
source .venv/bin/activate
pip install -e ".[dev]"
uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```

### Frontend

```bash
cd frontend
npm install
npm run dev
```

Open http://127.0.0.1:5173. The dev server proxies `/api` to http://127.0.0.1:8000.

### Tests

```bash
cd backend && python -m pytest -q
cd frontend && npm test -- --run
./scripts/smoke.sh
```
