# {{SERVICE_TITLE}}

这是由平台开发套件生成的独立 Python 服务仓库。它通过 OpenAPI、不可变镜像和 `service.manifest.json` 接入平台，不依赖平台 Monorepo 内部包。

脚手架执行 `--install` 后，Windows 可直接运行：

```powershell
.\.venv\Scripts\ruff.exe check .
.\.venv\Scripts\mypy.exe src
.\.venv\Scripts\python.exe -m pytest
.\.venv\Scripts\python.exe scripts\export_openapi.py
.\.venv\Scripts\python.exe -m service.main
```

若团队统一使用 uv，也可以运行：

```powershell
uv lock
uv sync --locked
uv run pytest
uv run python scripts/export_openapi.py
uv run python -m service.main
```

提交前必须提交 `uv.lock` 和最新的 `contracts/openapi.json`。然后在平台仓库执行 `pnpm register:service -- <本仓库路径>` 完成服务目录、契约锁和本地工作区注册。
