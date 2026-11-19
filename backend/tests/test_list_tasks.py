def test_list_empty(client):
    response = client.get("/api/tasks")
    assert response.status_code == 200
    assert response.json() == []


def test_list_newest_first(client):
    first = client.post("/api/tasks", json={"title": "先创建"}).json()
    second = client.post("/api/tasks", json={"title": "后创建"}).json()
    response = client.get("/api/tasks")
    assert response.status_code == 200
    assert [item["id"] for item in response.json()] == [second["id"], first["id"]]
    assert [item["title"] for item in response.json()] == ["后创建", "先创建"]
