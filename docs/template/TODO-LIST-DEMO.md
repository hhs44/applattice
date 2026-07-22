# Python Todo List 模板验证

本示例是一个完整的混合仓库纵向切片：

```text
Portal /todos
  -> Gateway /api/todos
  -> todo-list-service /api/v1/todos
  -> SQLite .data/todos.db
```

独立服务源码位于 `service-workspaces/todo-list-service`，该目录被平台仓库忽略，模拟独立 Git 仓库。服务拥有自己的 `pyproject.toml`、`uv.lock`、OpenAPI、测试、Dockerfile、数据和 `AGENTS.md`。

## 本地启动

```powershell
.\scripts\start-local-todo.ps1
pnpm smoke:todo
```

访问 `http://127.0.0.1:8080`，进入“Todo 清单”。停止服务：

```powershell
.\scripts\stop-local-todo.ps1
```

运行日志保留在 `.tmp/local-todo-runtime`。Todo 数据保留在 `service-workspaces/todo-list-service/.data/todos.db`。

## 服务质量检查

```powershell
Set-Location service-workspaces\todo-list-service
$env:UV_CACHE_DIR = (Resolve-Path .).Path + '\.uv-cache'
.\.venv\Scripts\uv.exe sync --locked
.\.venv\Scripts\uv.exe run ruff check .
.\.venv\Scripts\uv.exe run mypy src
.\.venv\Scripts\uv.exe run pytest
.\.venv\Scripts\uv.exe run python scripts\export_openapi.py
```

创建 Todo 需要 `Idempotency-Key`。服务使用 `x-principal-id` API-key 安全方案表示内部调用身份；浏览器不会直接访问该服务，该 Header 由 Gateway 根据已验证会话生成。
