from fastapi.testclient import TestClient

from backend.main import app


def test_health():
    client = TestClient(app)
    response = client.get("/health")

    assert response.status_code == 200
    assert response.json() == {"status": "ok"}


def test_threads_requires_authentication():
    client = TestClient(app)
    response = client.get("/threads")

    assert response.status_code == 401