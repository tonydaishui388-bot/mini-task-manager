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


def auth_username() -> str | None:
    value = os.environ.get("TASKS_AUTH_USERNAME")
    if value is None or value == "":
        return None
    return value


def auth_password_hash() -> str | None:
    value = os.environ.get("TASKS_AUTH_PASSWORD_HASH")
    if value is None or value == "":
        return None
    return value


def session_secret() -> str | None:
    value = os.environ.get("TASKS_SESSION_SECRET")
    if value is None or len(value) < 16:
        return None
    return value


def cookie_secure() -> bool:
    return os.environ.get("TASKS_COOKIE_SECURE") == "1"
