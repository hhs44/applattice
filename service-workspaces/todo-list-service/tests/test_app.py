from pathlib import Path

from fastapi.testclient import TestClient

from service.app import create_app
from service.config import Settings


def client(database: Path) -> TestClient:
    return TestClient(
        create_app(
            Settings(
                service_name="todo-list-service-test",
                service_port=4200,
                todo_database_path=database,
            )
        )
    )


def test_health_and_internal_identity(tmp_path: Path) -> None:
    with client(tmp_path / "health.db") as api:
        assert api.get("/health/ready").status_code == 200
        denied = api.get("/api/v1/todos", headers={"x-correlation-id": "trace-denied"})
        assert denied.status_code == 401
        assert denied.json()["correlationId"] == "trace-denied"


def test_todo_lifecycle_and_idempotency(tmp_path: Path) -> None:
    headers = {
        "x-principal-id": "engineer-1",
        "x-correlation-id": "trace-todo",
        "idempotency-key": "create-1",
    }
    with client(tmp_path / "todos.db") as api:
        created = api.post("/api/v1/todos", headers=headers, json={"title": "验证 Python 模板"})
        assert created.status_code == 201
        todo = created.json()
        assert todo["title"] == "验证 Python 模板"
        assert todo["completed"] is False
        assert created.headers["x-correlation-id"] == "trace-todo"

        replay = api.post("/api/v1/todos", headers=headers, json={"title": "验证 Python 模板"})
        assert replay.status_code == 201
        assert replay.json()["id"] == todo["id"]

        conflict = api.post("/api/v1/todos", headers=headers, json={"title": "不同请求"})
        assert conflict.status_code == 409
        assert conflict.json()["code"] == "IDEMPOTENCY_CONFLICT"

        listed = api.get("/api/v1/todos", headers=headers)
        assert listed.status_code == 200
        assert listed.json()["total"] == 1

        updated = api.patch(
            f"/api/v1/todos/{todo['id']}",
            headers=headers,
            json={"completed": True},
        )
        assert updated.status_code == 200
        assert updated.json()["completed"] is True

        deleted = api.delete(f"/api/v1/todos/{todo['id']}", headers=headers)
        assert deleted.status_code == 204
        missing = api.get(f"/api/v1/todos/{todo['id']}", headers=headers)
        assert missing.status_code == 404
        assert missing.json()["code"] == "TODO_NOT_FOUND"
