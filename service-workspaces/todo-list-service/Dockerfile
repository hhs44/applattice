ARG PYTHON_IMAGE=python:3.12-slim
ARG UV_IMAGE=ghcr.io/astral-sh/uv:0.8.14
FROM ${UV_IMAGE} AS uv
FROM ${PYTHON_IMAGE} AS builder
WORKDIR /app
COPY --from=uv /uv /uvx /bin/
COPY pyproject.toml uv.lock ./
RUN uv sync --locked --no-dev --no-install-project
COPY src ./src
RUN uv sync --locked --no-dev

FROM ${PYTHON_IMAGE} AS runtime
ENV PATH="/app/.venv/bin:${PATH}" PYTHONUNBUFFERED=1 PYTHONDONTWRITEBYTECODE=1
WORKDIR /app
COPY --from=builder /app/.venv /app/.venv
COPY src ./src
RUN mkdir -p /data && chown 65532:65532 /data
VOLUME ["/data"]
USER 65532:65532
CMD ["python", "-m", "service.main"]
