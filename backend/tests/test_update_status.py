import pytest


@pytest.fixture()
def authed(client, monkeypatch):
    from tests.test_auth import login

    login(client, monkeypatch)
    return client


def test_update_status(authed):
    created = authed.post("/api/tasks", json={"title": "报告"}).json()
    response = authed.patch(f"/api/tasks/{created['id']}", json={"status": "done"})
    assert response.status_code == 200
    body = response.json()
    assert body["status"] == "done"
    assert body["title"] == "报告"
    assert body["description"] == ""
    assert body["updated_at"].endswith("Z")
    assert body["updated_at"] >= body["created_at"]


def test_update_missing_task(authed):
    response = authed.patch("/api/tasks/999", json={"status": "done"})
    assert response.status_code == 404
    assert response.json()["detail"] == "Task not found"


def test_update_rejects_title_change(authed):
    created = authed.post("/api/tasks", json={"title": "报告"}).json()
    response = authed.patch(
        f"/api/tasks/{created['id']}",
        json={"status": "done", "title": "改标题"},
    )
    assert response.status_code == 422
    listed = authed.get("/api/tasks").json()
    assert listed[0]["title"] == "报告"
    assert listed[0]["status"] == "todo"


def test_update_rejects_bad_status(authed):
    created = authed.post("/api/tasks", json={"title": "报告"}).json()
    response = authed.patch(f"/api/tasks/{created['id']}", json={"status": "later"})
    assert response.status_code == 422


def test_update_rejects_non_positive_id(authed):
    response = authed.patch("/api/tasks/0", json={"status": "done"})
    assert response.status_code == 422
