from pathlib import Path

from fastapi.testclient import TestClient

from service.app import create_app
from service.config import Settings


def test_crud_and_idempotency(tmp_path: Path) -> None:
    app = create_app(
        Settings(service_name="test", service_port=__PORT__, database_path=tmp_path / "records.db")
    )
    headers = {
        "x-principal-id": "developer",
        "idempotency-key": "create-1",
        "x-correlation-id": "trace-1",
    }
    with TestClient(app) as api:
        assert api.get("/health/ready").status_code == 200
        assert api.get("/api/v1/records").status_code == 401
        created = api.post("/api/v1/records", headers=headers, json={"name": "第一条记录"})
        assert created.status_code == 201
        record = created.json()
        replay = api.post("/api/v1/records", headers=headers, json={"name": "第一条记录"})
        assert replay.json()["id"] == record["id"]
        assert api.get("/api/v1/records", headers=headers).json()["total"] == 1
        assert (
            api.patch(
                f"/api/v1/records/{record['id']}", headers=headers, json={"completed": True}
            ).json()["completed"]
            is True
        )
        assert api.delete(f"/api/v1/records/{record['id']}", headers=headers).status_code == 204
