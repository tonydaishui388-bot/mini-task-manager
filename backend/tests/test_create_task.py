import pytest


@pytest.fixture()
def authed(client, monkeypatch):
    from tests.test_auth import login

    login(client, monkeypatch)
    return client


def test_create_task_defaults(authed):
    response = authed.post("/api/tasks", json={"title": "买牛奶"})
    assert response.status_code == 201
    body = response.json()
    assert body["id"] == 1
    assert body["title"] == "买牛奶"
    assert body["description"] == ""
    assert body["status"] == "todo"
    assert body["created_at"].endswith("Z")
    assert body["updated_at"] == body["created_at"]


def test_create_task_strips_and_accepts_status(authed):
    response = authed.post(
        "/api/tasks",
        json={"title": "  写计划  ", "description": "  说明  ", "status": "in_progress"},
    )
    assert response.status_code == 201
    body = response.json()
    assert body["title"] == "写计划"
    assert body["description"] == "说明"
    assert body["status"] == "in_progress"


def test_create_task_rejects_blank_title(authed):
    assert authed.post("/api/tasks", json={"title": "   "}).status_code == 422
    assert authed.get("/api/tasks").json() == []


def test_create_task_rejects_unknown_field(authed):
    response = authed.post("/api/tasks", json={"title": "A", "owner": "tony"})
    assert response.status_code == 422


def test_create_task_rejects_bad_status(authed):
    response = authed.post("/api/tasks", json={"title": "A", "status": "archived"})
    assert response.status_code == 422


def test_create_task_rejects_long_title(authed):
    response = authed.post("/api/tasks", json={"title": "A" * 201})
    assert response.status_code == 422
