import pytest


@pytest.fixture()
def authed(client, monkeypatch):
    from tests.test_auth import login

    login(client, monkeypatch)
    return client


def test_list_empty(authed):
    response = authed.get("/api/tasks")
    assert response.status_code == 200
    assert response.json() == []


def test_list_newest_first(authed):
    first = authed.post("/api/tasks", json={"title": "先创建"}).json()
    second = authed.post("/api/tasks", json={"title": "后创建"}).json()
    response = authed.get("/api/tasks")
    assert response.status_code == 200
    assert [item["id"] for item in response.json()] == [second["id"], first["id"]]
    assert [item["title"] for item in response.json()] == ["后创建", "先创建"]
