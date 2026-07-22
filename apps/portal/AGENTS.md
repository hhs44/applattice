# 门户上下文

- 门户只依赖 `@platform/sdk`、`@platform/ui` 和浏览器侧契约，不承载核心业务规则。
- 新功能在 `src/features/<id>` 内聚；只通过 Gateway 的 `/api` 调用后端。
- 不引入服务真实地址、服务凭据或服务拓扑。
- 修改后优先运行 `pnpm --filter @platform/portal typecheck` 和 `pnpm --filter @platform/portal build`。
