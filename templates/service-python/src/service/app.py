from collections.abc import AsyncIterator
from contextlib import asynccontextmanager
from typing import Annotated, cast
from uuid import uuid4

from fastapi import Depends, FastAPI, Header, HTTPException, Request, Response, Security, status
from fastapi.responses import JSONResponse
from fastapi.security import APIKeyHeader

from .config import Settings, get_settings
from .models import CreateRecordRequest, Record, RecordList, UpdateRecordRequest
from .repository import IdempotencyConflictError, RecordNotFoundError, RecordRepository

principal_header = APIKeyHeader(name="x-principal-id", auto_error=False)


def create_app(settings: Settings | None = None) -> FastAPI:
    current = settings or get_settings()

    @asynccontextmanager
    async def lifespan(app: FastAPI) -> AsyncIterator[None]:
        app.state.repository = RecordRepository(current.database_path)
        yield
        app.state.repository.close()

    app = FastAPI(title="__SERVICE_TITLE__", version="1.0.0", lifespan=lifespan)

    @app.middleware("http")
    async def request_context(request: Request, call_next):  # type: ignore[no-untyped-def]
        request.state.correlation_id = request.headers.get("x-correlation-id") or str(uuid4())
        response = await call_next(request)
        response.headers["x-correlation-id"] = request.state.correlation_id
        return response

    def error_body(request: Request, code: str, message: str) -> dict[str, str]:
        return {"code": code, "message": message, "correlationId": request.state.correlation_id}

    @app.exception_handler(RecordNotFoundError)
    async def missing(request: Request, _error: RecordNotFoundError) -> JSONResponse:
        return JSONResponse(error_body(request, "RECORD_NOT_FOUND", "记录不存在"), status_code=404)

    @app.exception_handler(IdempotencyConflictError)
    async def conflict(request: Request, _error: IdempotencyConflictError) -> JSONResponse:
        return JSONResponse(
            error_body(request, "IDEMPOTENCY_CONFLICT", "幂等键已用于不同请求"), status_code=409
        )

    def repository(request: Request) -> RecordRepository:
        return cast(RecordRepository, request.app.state.repository)

    def principal(x_principal_id: Annotated[str | None, Security(principal_header)]) -> str:
        if not x_principal_id or not x_principal_id.strip():
            raise HTTPException(status_code=401, detail="缺少内部主体标识")
        return x_principal_id

    @app.get("/health/live", tags=["health"])
    async def live() -> dict[str, str]:
        return {"status": "ok", "service": current.service_name}

    @app.get("/health/ready", tags=["health"])
    async def ready(repo: Annotated[RecordRepository, Depends(repository)]) -> dict[str, str]:
        repo.list()
        return {"status": "ready", "service": current.service_name}

    @app.get("/api/v1/records", response_model=RecordList)
    async def list_records(
        repo: Annotated[RecordRepository, Depends(repository)],
        _identity: Annotated[str, Depends(principal)],
    ) -> RecordList:
        return repo.list()

    @app.get("/api/v1/records/{record_id}", response_model=Record)
    async def get_record(
        record_id: str,
        repo: Annotated[RecordRepository, Depends(repository)],
        _identity: Annotated[str, Depends(principal)],
    ) -> Record:
        return repo.get(record_id)

    @app.post("/api/v1/records", response_model=Record, status_code=status.HTTP_201_CREATED)
    async def create_record(
        payload: CreateRecordRequest,
        repo: Annotated[RecordRepository, Depends(repository)],
        identity: Annotated[str, Depends(principal)],
        idempotency_key: Annotated[str, Header(alias="Idempotency-Key", min_length=1)],
    ) -> Record:
        return repo.create(payload, identity, idempotency_key)

    @app.patch("/api/v1/records/{record_id}", response_model=Record)
    async def update_record(
        record_id: str,
        payload: UpdateRecordRequest,
        repo: Annotated[RecordRepository, Depends(repository)],
        _identity: Annotated[str, Depends(principal)],
    ) -> Record:
        return repo.update(record_id, payload)

    @app.delete("/api/v1/records/{record_id}", status_code=status.HTTP_204_NO_CONTENT)
    async def delete_record(
        record_id: str,
        repo: Annotated[RecordRepository, Depends(repository)],
        _identity: Annotated[str, Depends(principal)],
    ) -> Response:
        repo.delete(record_id)
        return Response(status_code=status.HTTP_204_NO_CONTENT)

    return app


app = create_app()
