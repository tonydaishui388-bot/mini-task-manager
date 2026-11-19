import pytest


@pytest.fixture()
def authed(client, monkeypatch):
    from tests.test_auth import login

    login(client, monkeypatch)
    return client


def test_delete_task(authed):
    created = authed.post("/api/tasks", json={"title": "临时"}).json()
    response = authed.delete(f"/api/tasks/{created['id']}")
    assert response.status_code == 204
    assert response.content == b""
    assert authed.get("/api/tasks").json() == []


def test_delete_missing_task(authed):
    response = authed.delete("/api/tasks/999")
    assert response.status_code == 404
    assert response.json()["detail"] == "Task not found"


def test_delete_twice(authed):
    created = authed.post("/api/tasks", json={"title": "临时"}).json()
    first = authed.delete(f"/api/tasks/{created['id']}")
    second = authed.delete(f"/api/tasks/{created['id']}")
    assert first.status_code == 204
    assert second.status_code == 404
