from typing import Annotated
from uuid import uuid4

from fastapi import Depends, FastAPI, HTTPException, Request, Security
from fastapi.security import APIKeyHeader

from .config import Settings, get_settings

principal_header = APIKeyHeader(name="x-principal-id", auto_error=False)


def create_app(settings: Settings | None = None) -> FastAPI:
    current = settings or get_settings()
    app = FastAPI(title="__SERVICE_TITLE__", version="1.0.0")

    @app.middleware("http")
    async def request_context(request: Request, call_next):  # type: ignore[no-untyped-def]
        request.state.correlation_id = request.headers.get("x-correlation-id") or str(uuid4())
        response = await call_next(request)
        response.headers["x-correlation-id"] = request.state.correlation_id
        return response

    def principal(x_principal_id: Annotated[str | None, Security(principal_header)]) -> str:
        if not x_principal_id or not x_principal_id.strip():
            raise HTTPException(status_code=401, detail="缺少内部主体标识")
        return x_principal_id

    @app.get("/health/live", tags=["health"])
    async def live() -> dict[str, str]:
        return {"status": "ok", "service": current.service_name}

    @app.get("/health/ready", tags=["health"])
    async def ready() -> dict[str, str]:
        return {"status": "ready", "service": current.service_name}

    @app.get("/api/v1/info")
    async def info(_identity: Annotated[str, Depends(principal)]) -> dict[str, str]:
        return {"service": current.service_name, "status": "starter"}

    return app


app = create_app()
