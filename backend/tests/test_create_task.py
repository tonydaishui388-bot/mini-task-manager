def test_create_task_defaults(client):
    response = client.post("/api/tasks", json={"title": "买牛奶"})
    assert response.status_code == 201
    body = response.json()
    assert body["id"] == 1
    assert body["title"] == "买牛奶"
    assert body["description"] == ""
    assert body["status"] == "todo"
    assert body["created_at"].endswith("Z")
    assert body["updated_at"] == body["created_at"]


def test_create_task_strips_and_accepts_status(client):
    response = client.post(
        "/api/tasks",
        json={"title": "  写计划  ", "description": "  说明  ", "status": "in_progress"},
    )
    assert response.status_code == 201
    body = response.json()
    assert body["title"] == "写计划"
    assert body["description"] == "说明"
    assert body["status"] == "in_progress"


def test_create_task_rejects_blank_title(client):
    assert client.post("/api/tasks", json={"title": "   "}).status_code == 422
    assert client.get("/api/tasks").json() == []


def test_create_task_rejects_unknown_field(client):
    response = client.post("/api/tasks", json={"title": "A", "owner": "tony"})
    assert response.status_code == 422


def test_create_task_rejects_bad_status(client):
    response = client.post("/api/tasks", json={"title": "A", "status": "archived"})
    assert response.status_code == 422


def test_create_task_rejects_long_title(client):
    response = client.post("/api/tasks", json={"title": "A" * 201})
    assert response.status_code == 422
