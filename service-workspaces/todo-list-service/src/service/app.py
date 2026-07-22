import json
import logging
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager
from typing import Annotated, cast
from uuid import uuid4

from fastapi import Depends, FastAPI, Header, HTTPException, Request, Response, Security, status
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from fastapi.security import APIKeyHeader

from .config import Settings, get_settings
from .models import CreateTodoRequest, Todo, TodoList, UpdateTodoRequest
from .repository import IdempotencyConflictError, TodoNotFoundError, TodoRepository

logger = logging.getLogger("todo-list-service")
principal_header = APIKeyHeader(name="x-principal-id", auto_error=False)


def create_app(settings: Settings | None = None) -> FastAPI:
    current_settings = settings or get_settings()

    @asynccontextmanager
    async def lifespan(app: FastAPI) -> AsyncIterator[None]:
        app.state.repository = TodoRepository(current_settings.todo_database_path)
        yield
        app.state.repository.close()

    app = FastAPI(title="Todo List 服务", version="1.0.0", lifespan=lifespan)

    @app.middleware("http")
    async def request_context(request: Request, call_next):  # type: ignore[no-untyped-def]
        correlation_id = request.headers.get("x-correlation-id") or str(uuid4())
        request.state.correlation_id = correlation_id
        response = await call_next(request)
        response.headers["x-correlation-id"] = correlation_id
        logger.info(
            json.dumps(
                {
                    "event": "request_completed",
                    "method": request.method,
                    "path": request.url.path,
                    "status": response.status_code,
                    "correlationId": correlation_id,
                },
                ensure_ascii=False,
            )
        )
        return response

    def error_body(
        request: Request, code: str, message: str, details: object | None = None
    ) -> dict[str, object]:
        body: dict[str, object] = {
            "code": code,
            "message": message,
            "correlationId": request.state.correlation_id,
        }
        if details is not None:
            body["details"] = details
        return body

    @app.exception_handler(TodoNotFoundError)
    async def not_found(request: Request, _error: TodoNotFoundError) -> JSONResponse:
        return JSONResponse(error_body(request, "TODO_NOT_FOUND", "Todo 不存在"), status_code=404)

    @app.exception_handler(IdempotencyConflictError)
    async def idempotency_conflict(
        request: Request, _error: IdempotencyConflictError
    ) -> JSONResponse:
        return JSONResponse(
            error_body(request, "IDEMPOTENCY_CONFLICT", "幂等键已用于不同请求"),
            status_code=409,
        )

    @app.exception_handler(HTTPException)
    async def http_error(request: Request, error: HTTPException) -> JSONResponse:
        return JSONResponse(
            error_body(request, "HTTP_ERROR", str(error.detail)), status_code=error.status_code
        )

    @app.exception_handler(RequestValidationError)
    async def validation_error(request: Request, error: RequestValidationError) -> JSONResponse:
        return JSONResponse(
            error_body(request, "INVALID_ARGUMENT", "请求参数不合法", error.errors()),
            status_code=422,
        )

    def repository(request: Request) -> TodoRepository:
        return cast(TodoRepository, request.app.state.repository)

    def principal(
        x_principal_id: Annotated[str | None, Security(principal_header)],
    ) -> str:
        if not x_principal_id or not x_principal_id.strip():
            raise HTTPException(status_code=401, detail="缺少内部主体标识")
        return x_principal_id

    @app.get("/health/live", tags=["health"])
    async def live() -> dict[str, str]:
        return {"status": "ok", "service": current_settings.service_name}

    @app.get("/health/ready", tags=["health"])
    async def ready(repo: Annotated[TodoRepository, Depends(repository)]) -> dict[str, str]:
        repo.list()
        return {"status": "ready", "service": current_settings.service_name}

    @app.get("/api/v1/info", tags=["service"])
    async def info(request: Request) -> dict[str, str]:
        return {
            "id": current_settings.service_name,
            "title": "Todo List 服务",
            "correlationId": request.state.correlation_id,
        }

    @app.get("/api/v1/todos", response_model=TodoList, tags=["todos"])
    async def list_todos(
        repo: Annotated[TodoRepository, Depends(repository)],
        _principal: Annotated[str, Depends(principal)],
    ) -> TodoList:
        return repo.list()

    @app.get("/api/v1/todos/{todo_id}", response_model=Todo, tags=["todos"])
    async def get_todo(
        todo_id: str,
        repo: Annotated[TodoRepository, Depends(repository)],
        _principal: Annotated[str, Depends(principal)],
    ) -> Todo:
        return repo.get(todo_id)

    @app.post(
        "/api/v1/todos", response_model=Todo, status_code=status.HTTP_201_CREATED, tags=["todos"]
    )
    async def create_todo(
        payload: CreateTodoRequest,
        repo: Annotated[TodoRepository, Depends(repository)],
        current_principal: Annotated[str, Depends(principal)],
        idempotency_key: Annotated[str, Header(alias="Idempotency-Key", min_length=1)],
    ) -> Todo:
        return repo.create(payload, current_principal, idempotency_key)

    @app.patch("/api/v1/todos/{todo_id}", response_model=Todo, tags=["todos"])
    async def update_todo(
        todo_id: str,
        payload: UpdateTodoRequest,
        repo: Annotated[TodoRepository, Depends(repository)],
        _principal: Annotated[str, Depends(principal)],
    ) -> Todo:
        return repo.update(todo_id, payload)

    @app.delete(
        "/api/v1/todos/{todo_id}", status_code=status.HTTP_204_NO_CONTENT, tags=["todos"]
    )
    async def delete_todo(
        todo_id: str,
        repo: Annotated[TodoRepository, Depends(repository)],
        _principal: Annotated[str, Depends(principal)],
    ) -> Response:
        repo.delete(todo_id)
        return Response(status_code=status.HTTP_204_NO_CONTENT)

    return app


app = create_app()
