# {{APP_TITLE}} AI 协作说明

- `frontend` 是可独立运行、也可由平台动态加载的远程前端。
- `backend` 独占业务规则、可选数据库和 OpenAPI，浏览器只能经平台 Gateway 调用。
- 跨仓依赖使用 `vendor` 中的版本化 tgz，不得使用 `workspace:*`。
- 修改接口后先更新 `backend/contracts/openapi.json`，再更新前端客户端。
- 提交前运行 `pnpm verify`，Python 后端另运行 `uv run pytest`。
