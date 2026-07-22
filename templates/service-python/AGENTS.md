# AI 工作边界

- 本仓库只拥有 `__SERVICE_ID__` 的业务规则、数据和 OpenAPI。
- 修改接口时先改测试和实现，再执行 `uv run python scripts/export_openapi.py`；不得只手改导出的契约。
- 不读取平台仓库全部源码。跨仓联调只需要 `service.manifest.json`、契约版本和失败的消费者测试。
- 写操作必须定义幂等语义；日志必须传播 `x-correlation-id`；不得记录凭据或完整敏感载荷。
- 完成前运行 `uv run ruff check .`、`uv run mypy src`、`uv run pytest`。
