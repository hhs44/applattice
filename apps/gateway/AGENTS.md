# Gateway / BFF 上下文

- Gateway 负责 OIDC、RBAC、前端专用聚合、防腐适配、超时和统一错误，不拥有领域数据。
- 每个上游必须先注册在 `platform/service-catalog.json` 并锁定 OpenAPI。
- 使用 `ServiceClient` 按服务 ID 调用；禁止在路由里硬编码主机名或读取独立服务数据库。
- 接口变更需要消费者测试；修改后运行 `pnpm --filter @applattice/gateway typecheck` 和测试。
