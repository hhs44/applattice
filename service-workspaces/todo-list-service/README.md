# Todo 清单全栈示例

这是由平台脚手架生成并纳入主仓库验证的官方示例。它包含 React + Vite 远程前端、FastAPI 后端、SQLite、OpenAPI 契约和联合应用清单；业务代码不进入 Portal，并且不依赖平台 Monorepo 的 `workspace:*` 包。

在本目录初始化：

```powershell
uv sync --locked
pnpm install --frozen-lockfile
uv run pytest
uv run python scripts/export_openapi.py
pnpm verify
```

单独运行后端：

```powershell
uv run python -m service.main
```

完整平台联调请回到平台仓库根目录执行：

```powershell
.\scripts\start-local-todo.ps1
pnpm smoke:todo
```

后端默认监听 `4200`，远程前端默认监听 `4300`，数据写入 `.data/todos.db`。所有 `/api/v1/todos` 请求必须由 Gateway 提供 `x-principal-id`；创建 Todo 还必须提供 `Idempotency-Key`。

如果将本示例复制成真正的独立业务仓库，应重新设置应用 ID、负责人、镜像和仓库地址，并在平台仓库使用 `pnpm register:app -- <业务仓库路径>` 注册。提交接口变化前必须更新 `uv.lock` 和 `contracts/openapi.json`。
