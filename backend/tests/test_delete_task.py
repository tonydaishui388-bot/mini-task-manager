def test_delete_task(client):
    created = client.post("/api/tasks", json={"title": "临时"}).json()
    response = client.delete(f"/api/tasks/{created['id']}")
    assert response.status_code == 204
    assert response.content == b""
    assert client.get("/api/tasks").json() == []


def test_delete_missing_task(client):
    response = client.delete("/api/tasks/999")
    assert response.status_code == 404
    assert response.json()["detail"] == "Task not found"


def test_delete_twice(client):
    created = client.post("/api/tasks", json={"title": "临时"}).json()
    first = client.delete(f"/api/tasks/{created['id']}")
    second = client.delete(f"/api/tasks/{created['id']}")
    assert first.status_code == 204
    assert second.status_code == 404
