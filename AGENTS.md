# 平台仓库 AI 协作说明

## 默认上下文

先阅读本文件，以及任务所涉及目录中最近的 `AGENTS.md`。除非排障证据要求，不要扫描整个仓库，也不要读取 `node_modules`、`dist`、`.generated`、锁文件或离线制品。

| 任务     | 最小上下文                                                            |
| -------- | --------------------------------------------------------------------- |
| 门户功能 | `apps/portal`、`packages/platform-sdk`、相关契约                      |
| BFF 接入 | `apps/gateway`、`platform/service-catalog.json`、目标 OpenAPI         |
| 服务接入 | `service.manifest.json`、目标 OpenAPI、`scripts/register-service.mjs` |
| 部署     | `deployment/compose.platform.yaml`、服务目录、发布清单                |
| 架构     | `docs/architecture/hybrid-repository.mmd`、ADR-0005                   |

## 仓库边界

- 本仓库拥有统一门户、Gateway/BFF、UI、浏览器 SDK、服务目录、契约锁和平台发布编排。
- 独立业务服务拥有自己的业务规则、数据库、OpenAPI、镜像和发布流水线。
- 不得让独立服务引用 `workspace:*` 包；跨仓共享只通过版本化 npm/PyPI 制品、OpenAPI、事件 Schema 或镜像。
- Gateway 是浏览器唯一后端入口；门户不得读取服务目录后直连业务服务。
- `apps/domain-service` 是迁移兼容样例，不是新服务的默认落点。

## 完成门槛

相关改动至少运行最小范围测试。提交平台级改动前运行：

```powershell
pnpm contracts:verify
pnpm typecheck
pnpm test
pnpm build
pnpm format:check
```
