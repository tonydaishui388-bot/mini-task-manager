import hashlib
import secrets
import sqlite3

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import text


def configure_auth(monkeypatch) -> tuple[str, str]:
    username = "ada"
    password = secrets.token_urlsafe(18)
    salt = secrets.token_bytes(16)
    digest = hashlib.pbkdf2_hmac("sha256", password.encode(), salt, 200000)
    encoded = f"pbkdf2_sha256$200000${salt.hex()}${digest.hex()}"
    monkeypatch.setenv("TASKS_AUTH_USERNAME", username)
    monkeypatch.setenv("TASKS_AUTH_PASSWORD_HASH", encoded)
    monkeypatch.setenv("TASKS_SESSION_SECRET", secrets.token_hex(16))
    return username, password


def login(client, monkeypatch):
    username, password = configure_auth(monkeypatch)
    response = client.post(
        "/api/login",
        json={"username": username, "password": password},
    )
    assert response.status_code == 204
    return username


def _cookie_parts(response) -> list[str]:
    header = response.headers.get("set-cookie", "")
    return [part.strip() for part in header.split(";") if part.strip()]


def test_login_success_sets_session_cookie(client, monkeypatch):
    username, password = configure_auth(monkeypatch)
    response = client.post(
        "/api/login",
        json={"username": username, "password": password},
    )
    assert response.status_code == 204
    assert response.content == b""
    parts = _cookie_parts(response)
    name, separator, value = parts[0].partition("=")
    assert separator == "="
    assert name == "task_session"
    assert value != ""
    flags = {part.lower() for part in parts[1:]}
    assert "httponly" in flags
    assert "path=/" in flags
    assert "samesite=lax" in flags
    assert "max-age=43200" in flags
    assert "secure" not in flags


def test_login_secure_cookie_when_requested(client, monkeypatch):
    username, password = configure_auth(monkeypatch)
    monkeypatch.setenv("TASKS_COOKIE_SECURE", "1")
    response = client.post(
        "/api/login",
        json={"username": username, "password": password},
    )
    assert response.status_code == 204
    flags = {part.lower() for part in _cookie_parts(response)[1:]}
    assert "secure" in flags


def test_login_rejects_bad_password(client, monkeypatch):
    username, _password = configure_auth(monkeypatch)
    response = client.post(
        "/api/login",
        json={"username": username, "password": secrets.token_urlsafe(18)},
    )
    assert response.status_code == 401
    assert response.json()["detail"] == "Invalid credentials"


def test_login_rejects_empty_fields(client):
    filler = secrets.token_urlsafe(12)
    payloads = [
        {},
        {"username": "", "password": ""},
        {"username": "ada", "password": ""},
        {"username": "", "password": filler},
        {"username": "   ", "password": "   "},
    ]
    for payload in payloads:
        response = client.post("/api/login", json=payload)
        assert response.status_code == 422


def test_login_missing_env_is_unavailable(client, monkeypatch):
    monkeypatch.delenv("TASKS_AUTH_USERNAME", raising=False)
    monkeypatch.delenv("TASKS_AUTH_PASSWORD_HASH", raising=False)
    monkeypatch.delenv("TASKS_SESSION_SECRET", raising=False)
    response = client.post(
        "/api/login",
        json={"username": "ada", "password": secrets.token_urlsafe(18)},
    )
    assert response.status_code == 503
    assert response.json()["detail"] == "Auth is not configured"


@pytest.mark.parametrize(
    "missing",
    ["TASKS_AUTH_USERNAME", "TASKS_AUTH_PASSWORD_HASH", "TASKS_SESSION_SECRET"],
)
def test_login_requires_each_auth_setting(client, monkeypatch, missing):
    username, password = configure_auth(monkeypatch)
    monkeypatch.delenv(missing)
    response = client.post(
        "/api/login",
        json={"username": username, "password": password},
    )
    assert response.status_code == 503
    assert response.json()["detail"] == "Auth is not configured"


def test_login_rejects_short_session_secret(client, monkeypatch):
    username, password = configure_auth(monkeypatch)
    monkeypatch.setenv("TASKS_SESSION_SECRET", "x" * 15)
    response = client.post(
        "/api/login",
        json={"username": username, "password": password},
    )
    assert response.status_code == 503
    assert response.json()["detail"] == "Auth is not configured"


def test_login_rejects_malformed_password_hash(client, monkeypatch):
    username, password = configure_auth(monkeypatch)
    monkeypatch.setenv("TASKS_AUTH_PASSWORD_HASH", "not-a-valid-hash")
    response = client.post(
        "/api/login",
        json={"username": username, "password": password},
    )
    assert response.status_code == 503
    assert response.json()["detail"] == "Auth is not configured"


def test_me_requires_session(client):
    response = client.get("/api/me")
    assert response.status_code == 401


def test_me_returns_username(client, monkeypatch):
    username = login(client, monkeypatch)
    response = client.get("/api/me")
    assert response.status_code == 200
    assert response.json() == {"username": username}


def test_logout_without_cookie(client):
    response = client.post("/api/logout")
    assert response.status_code == 204
    assert response.content == b""


def test_logout_invalidates_cookie(client, monkeypatch):
    login(client, monkeypatch)
    token = client.cookies.get("task_session")
    assert token is not None
    response = client.post("/api/logout")
    assert response.status_code == 204
    client.cookies.clear()
    client.cookies.set("task_session", token)
    reused = client.get("/api/me")
    assert reused.status_code == 401
    listed = client.get("/api/tasks")
    assert listed.status_code == 401


def test_task_list_requires_session(client):
    response = client.get("/api/tasks")
    assert response.status_code == 401


def test_create_task_sets_owner(client, monkeypatch):
    login(client, monkeypatch)
    created = client.post("/api/tasks", json={"title": "买牛奶"})
    assert created.status_code == 201
    task_id = created.json()["id"]
    with client.app.state.engine.connect() as connection:
        owner_id = connection.execute(
            text("SELECT owner_id FROM tasks WHERE id = :id"),
            {"id": task_id},
        ).scalar()
    assert owner_id is not None


def test_null_owner_task_remains_listed(client, monkeypatch):
    login(client, monkeypatch)
    with client.app.state.engine.begin() as connection:
        connection.execute(
            text(
                "INSERT INTO tasks (title, description, status, created_at, updated_at, owner_id) "
                "VALUES (:title, '', 'todo', :stamp, :stamp, NULL)"
            ),
            {
                "title": "旧任务",
                "stamp": "2026-11-19 00:00:00",
            },
        )
    listed = client.get("/api/tasks")
    assert listed.status_code == 200
    assert [item["title"] for item in listed.json()] == ["旧任务"]


def test_expired_session_is_rejected(client, monkeypatch):
    login(client, monkeypatch)
    token = client.cookies.get("task_session")
    with client.app.state.engine.begin() as connection:
        connection.execute(text("UPDATE sessions SET expires_at = :stamp"), {"stamp": "2000-01-01 00:00:00"})
    client.cookies.clear()
    client.cookies.set("task_session", token)
    response = client.get("/api/me")
    assert response.status_code == 401


def test_startup_adds_owner_column_and_keeps_tasks(tmp_path, monkeypatch):
    db_file = tmp_path / "legacy.db"
    connection = sqlite3.connect(db_file)
    connection.execute(
        """
        CREATE TABLE tasks (
            id INTEGER NOT NULL PRIMARY KEY,
            title VARCHAR(200) NOT NULL,
            description VARCHAR(2000) NOT NULL,
            status VARCHAR(20) NOT NULL,
            created_at DATETIME NOT NULL,
            updated_at DATETIME NOT NULL,
            CONSTRAINT ck_tasks_status CHECK (status IN ('todo','in_progress','done'))
        )
        """
    )
    connection.execute(
        "INSERT INTO tasks (id, title, description, status, created_at, updated_at) "
        "VALUES (7, ?, '', 'todo', ?, ?)",
        ("遗留任务", "2026-11-19 00:00:00", "2026-11-19 00:00:00"),
    )
    connection.commit()
    connection.close()

    monkeypatch.setenv("TASKS_DATABASE_URL", f"sqlite:///{db_file}")
    from app.main import create_app

    with TestClient(create_app()) as client:
        assert client.get("/api/health").status_code == 200

    connection = sqlite3.connect(db_file)
    columns = connection.execute("PRAGMA table_info(tasks)").fetchall()
    by_name = {column[1]: column for column in columns}
    assert "owner_id" in by_name
    assert by_name["owner_id"][2].upper() == "INTEGER"
    assert by_name["owner_id"][3] == 0
    row = connection.execute("SELECT id, title, owner_id FROM tasks").fetchone()
    assert row == (7, "遗留任务", None)
    tables = {
        item[0]
        for item in connection.execute("SELECT name FROM sqlite_master WHERE type = 'table'")
    }
    assert "tasks" in tables
    assert "sessions" in tables
    connection.close()


def test_cors_allows_credentials_for_dev_origins(client):
    for origin in ("http://127.0.0.1:5173", "http://localhost:5173"):
        response = client.get("/api/health", headers={"Origin": origin})
        assert response.headers.get("access-control-allow-origin") == origin
        assert response.headers.get("access-control-allow-credentials") == "true"


def test_cors_rejects_other_origins(client):
    response = client.get("/api/health", headers={"Origin": "https://evil.example"})
    assert response.headers.get("access-control-allow-origin") is None
