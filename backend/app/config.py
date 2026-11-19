import os
from pathlib import Path


def database_url() -> str:
    configured = os.environ.get("TASKS_DATABASE_URL")
    if configured:
        return configured
    data_dir = Path(__file__).resolve().parent.parent / "data"
    data_dir.mkdir(parents=True, exist_ok=True)
    return f"sqlite:///{data_dir / 'tasks.db'}"


def cors_origins() -> list[str]:
    configured = os.environ.get("TASKS_CORS_ORIGINS")
    if configured is None:
        return ["http://127.0.0.1:5173", "http://localhost:5173"]
    return [item.strip() for item in configured.split(",") if item.strip()]
