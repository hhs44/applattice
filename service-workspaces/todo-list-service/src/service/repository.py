import hashlib
import json
import sqlite3
from datetime import UTC, datetime
from pathlib import Path
from threading import RLock
from uuid import uuid4

from .models import CreateTodoRequest, Todo, TodoList, UpdateTodoRequest


class TodoNotFoundError(Exception):
    pass


class IdempotencyConflictError(Exception):
    pass


def utc_now() -> str:
    return datetime.now(UTC).isoformat().replace("+00:00", "Z")


class TodoRepository:
    def __init__(self, database_path: Path | str) -> None:
        if database_path != ":memory:":
            Path(database_path).parent.mkdir(parents=True, exist_ok=True)
        self._connection = sqlite3.connect(str(database_path), check_same_thread=False)
        self._connection.row_factory = sqlite3.Row
        self._lock = RLock()
        self._initialize()

    def _initialize(self) -> None:
        with self._connection:
            self._connection.executescript(
                """
                CREATE TABLE IF NOT EXISTS todos (
                    id TEXT PRIMARY KEY,
                    title TEXT NOT NULL,
                    completed INTEGER NOT NULL DEFAULT 0,
                    created_at TEXT NOT NULL,
                    updated_at TEXT NOT NULL
                );
                CREATE TABLE IF NOT EXISTS idempotency_keys (
                    principal_id TEXT NOT NULL,
                    idempotency_key TEXT NOT NULL,
                    request_hash TEXT NOT NULL,
                    todo_id TEXT NOT NULL REFERENCES todos(id),
                    PRIMARY KEY (principal_id, idempotency_key)
                );
                """
            )

    @staticmethod
    def _todo(row: sqlite3.Row) -> Todo:
        return Todo(
            id=row["id"],
            title=row["title"],
            completed=bool(row["completed"]),
            created_at=datetime.fromisoformat(row["created_at"].replace("Z", "+00:00")),
            updated_at=datetime.fromisoformat(row["updated_at"].replace("Z", "+00:00")),
        )

    def list(self) -> TodoList:
        with self._lock:
            rows = self._connection.execute(
                "SELECT * FROM todos ORDER BY created_at DESC, id DESC"
            ).fetchall()
        items = [self._todo(row) for row in rows]
        return TodoList(items=items, total=len(items))

    def get(self, todo_id: str) -> Todo:
        with self._lock:
            row = self._connection.execute(
                "SELECT * FROM todos WHERE id = ?", (todo_id,)
            ).fetchone()
        if row is None:
            raise TodoNotFoundError(todo_id)
        return self._todo(row)

    def create(self, request: CreateTodoRequest, principal_id: str, idempotency_key: str) -> Todo:
        title = request.title.strip()
        request_hash = hashlib.sha256(
            json.dumps({"title": title}, sort_keys=True).encode("utf-8")
        ).hexdigest()
        with self._lock, self._connection:
            previous = self._connection.execute(
                """
                SELECT request_hash, todo_id FROM idempotency_keys
                WHERE principal_id = ? AND idempotency_key = ?
                """,
                (principal_id, idempotency_key),
            ).fetchone()
            if previous is not None:
                if previous["request_hash"] != request_hash:
                    raise IdempotencyConflictError(idempotency_key)
                return self.get(previous["todo_id"])

            todo_id = str(uuid4())
            timestamp = utc_now()
            self._connection.execute(
                """
                INSERT INTO todos(id, title, completed, created_at, updated_at)
                VALUES (?, ?, 0, ?, ?)
                """,
                (todo_id, title, timestamp, timestamp),
            )
            self._connection.execute(
                """
                INSERT INTO idempotency_keys(principal_id, idempotency_key, request_hash, todo_id)
                VALUES (?, ?, ?, ?)
                """,
                (principal_id, idempotency_key, request_hash, todo_id),
            )
        return self.get(todo_id)

    def update(self, todo_id: str, request: UpdateTodoRequest) -> Todo:
        current = self.get(todo_id)
        title = request.title.strip() if request.title is not None else current.title
        completed = request.completed if request.completed is not None else current.completed
        with self._lock, self._connection:
            self._connection.execute(
                """
                UPDATE todos SET title = ?, completed = ?, updated_at = ? WHERE id = ?
                """,
                (title, int(completed), utc_now(), todo_id),
            )
        return self.get(todo_id)

    def delete(self, todo_id: str) -> None:
        with self._lock, self._connection:
            self._connection.execute("DELETE FROM idempotency_keys WHERE todo_id = ?", (todo_id,))
            cursor = self._connection.execute("DELETE FROM todos WHERE id = ?", (todo_id,))
        if cursor.rowcount == 0:
            raise TodoNotFoundError(todo_id)

    def close(self) -> None:
        self._connection.close()
