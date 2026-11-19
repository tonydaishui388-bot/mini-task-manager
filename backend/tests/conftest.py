import pytest
from fastapi.testclient import TestClient


@pytest.fixture()
def client(tmp_path, monkeypatch):
    db_file = tmp_path / "tasks.db"
    monkeypatch.setenv("TASKS_DATABASE_URL", f"sqlite:///{db_file}")
    from app.main import create_app

    application = create_app()
    with TestClient(application) as test_client:
        yield test_client
