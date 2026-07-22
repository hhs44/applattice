import hashlib
import json
import sqlite3
from datetime import UTC, datetime
from pathlib import Path
from threading import RLock
from uuid import uuid4

from .models import CreateRecordRequest, Record, RecordList, UpdateRecordRequest


class RecordNotFoundError(Exception):
    pass


class IdempotencyConflictError(Exception):
    pass


class RecordRepository:
    def __init__(self, database_path: Path | str) -> None:
        if database_path != ":memory:":
            Path(database_path).parent.mkdir(parents=True, exist_ok=True)
        self.connection = sqlite3.connect(str(database_path), check_same_thread=False)
        self.connection.row_factory = sqlite3.Row
        self.lock = RLock()
        with self.connection:
            self.connection.executescript("""
              CREATE TABLE IF NOT EXISTS records (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                completed INTEGER NOT NULL DEFAULT 0,
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL
              );
              CREATE TABLE IF NOT EXISTS idempotency_keys (
                principal_id TEXT NOT NULL,
                idempotency_key TEXT NOT NULL,
                request_hash TEXT NOT NULL,
                record_id TEXT NOT NULL REFERENCES records(id),
                PRIMARY KEY (principal_id, idempotency_key)
              );
            """)

    @staticmethod
    def model(row: sqlite3.Row) -> Record:
        return Record(
            id=row["id"],
            name=row["name"],
            completed=bool(row["completed"]),
            created_at=datetime.fromisoformat(row["created_at"].replace("Z", "+00:00")),
            updated_at=datetime.fromisoformat(row["updated_at"].replace("Z", "+00:00")),
        )

    def list(self) -> RecordList:
        with self.lock:
            rows = self.connection.execute(
                "SELECT * FROM records ORDER BY created_at DESC"
            ).fetchall()
        items = [self.model(row) for row in rows]
        return RecordList(items=items, total=len(items))

    def get(self, record_id: str) -> Record:
        with self.lock:
            row = self.connection.execute(
                "SELECT * FROM records WHERE id = ?", (record_id,)
            ).fetchone()
        if row is None:
            raise RecordNotFoundError(record_id)
        return self.model(row)

    def create(self, payload: CreateRecordRequest, principal_id: str, key: str) -> Record:
        request_hash = hashlib.sha256(
            json.dumps({"name": payload.name}, sort_keys=True).encode()
        ).hexdigest()
        with self.lock, self.connection:
            previous = self.connection.execute(
                "SELECT request_hash, record_id FROM idempotency_keys "
                "WHERE principal_id = ? AND idempotency_key = ?",
                (principal_id, key),
            ).fetchone()
            if previous:
                if previous["request_hash"] != request_hash:
                    raise IdempotencyConflictError(key)
                return self.get(previous["record_id"])
            record_id = str(uuid4())
            timestamp = datetime.now(UTC).isoformat().replace("+00:00", "Z")
            self.connection.execute(
                "INSERT INTO records VALUES (?, ?, 0, ?, ?)",
                (record_id, payload.name, timestamp, timestamp),
            )
            self.connection.execute(
                "INSERT INTO idempotency_keys VALUES (?, ?, ?, ?)",
                (principal_id, key, request_hash, record_id),
            )
        return self.get(record_id)

    def update(self, record_id: str, payload: UpdateRecordRequest) -> Record:
        current = self.get(record_id)
        timestamp = datetime.now(UTC).isoformat().replace("+00:00", "Z")
        with self.lock, self.connection:
            self.connection.execute(
                "UPDATE records SET name = ?, completed = ?, updated_at = ? WHERE id = ?",
                (
                    payload.name or current.name,
                    int(payload.completed if payload.completed is not None else current.completed),
                    timestamp,
                    record_id,
                ),
            )
        return self.get(record_id)

    def delete(self, record_id: str) -> None:
        with self.lock, self.connection:
            self.connection.execute(
                "DELETE FROM idempotency_keys WHERE record_id = ?", (record_id,)
            )
            cursor = self.connection.execute("DELETE FROM records WHERE id = ?", (record_id,))
        if cursor.rowcount == 0:
            raise RecordNotFoundError(record_id)

    def close(self) -> None:
        self.connection.close()
