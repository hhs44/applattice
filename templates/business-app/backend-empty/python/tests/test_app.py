from fastapi.testclient import TestClient

from service.app import create_app
from service.config import Settings


def test_health_and_protected_starter_endpoint() -> None:
    app = create_app(Settings(service_name="test", service_port=__PORT__))
    with TestClient(app) as api:
        assert api.get("/health/ready").status_code == 200
        assert api.get("/api/v1/info").status_code == 401
        response = api.get(
            "/api/v1/info",
            headers={"x-principal-id": "developer", "x-correlation-id": "trace-1"},
        )
        assert response.status_code == 200
        assert response.headers["x-correlation-id"] == "trace-1"
        assert response.json() == {"service": "test", "status": "starter"}
