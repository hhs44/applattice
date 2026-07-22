# AI 工作边界

- 本仓库只拥有 `__SERVICE_ID__` 的业务规则、数据和 OpenAPI。
- 不引用平台 Monorepo 的 workspace 包；跨仓依赖必须是版本化制品或网络契约。
- 不读取平台仓库全部源码。跨仓联调只需要 `service.manifest.json`、契约版本和失败的消费者测试。
- 写操作必须定义幂等语义；日志必须传播 `x-correlation-id`；不得记录凭据或完整敏感载荷。
- 完成前运行 `pnpm verify`。
