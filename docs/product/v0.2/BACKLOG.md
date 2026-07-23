# AppLattice v0.2 分阶段 Backlog

## Phase 0：设计与高保真原型

- 完成产品定义、权限模型、GitOps/IAM/生命周期 ADR 和双格式架构图。
- 在 Portal 内交付 Mock 控制面，覆盖六种确定性场景、明暗主题和响应式布局。
- 在公共契约包定义应用、版本、部署、兼容、IAM、审计和健康类型。
- 定义 v1 目录迁移规则、REST API 草案和 CLI 命令面。

验收：Mock 原型完整走通登录预览、注册、验证、发布、升级、回滚、归档和权限管理；所有质量门禁、浏览器检查和图形校验通过。

## Phase 1：最小控制面

- 新增独立 Control Plane 服务和 PostgreSQL 迁移；提供本地管理员引导、备份与恢复命令。
- 实现本地账号、服务端会话、Gateway 内省和 30 秒撤权上限。
- 定义按应用拆分的 Git 声明、不可变版本和编译快照。
- 实现 `doctor`、`validate`、`register`、`dev`，保留现有 pnpm 别名。
- 以 Todo 应用贯通创建、验证、注册和联合开发。

依赖：Phase 0 契约和 ADR 冻结。验收：控制面数据库故障时鉴权失败关闭；v1 目录可无损迁移并回退。

## Phase 2：生命周期与 IAM

- 实现 OIDC Authorization Code + PKCE、外部身份关联和组映射。
- 实现用户、组、角色、作用域绑定和会话撤销 API。
- 实现应用、版本、部署三层状态机及非法跳转保护。
- 实现 `publish`、`rollback` 和归档提案；把 Portal Repository 切换为 HTTP。
- 记录身份、授权、验证和发布审计。

依赖：Phase 1 会话与 Git 快照。验收：发布只引用已验证版本；回滚产生新修订；活动部署阻止归档。

## Phase 3：可信交付与运维

- 落地 Bridge、SDK、UI、Manifest、OpenAPI 和平台版本兼容门禁。
- 校验 digest、Cosign 签名、CycloneDX 1.7 SBOM、漏洞报告和例外有效期。
- 采集远程加载、Gateway 链路、服务健康和关联 ID。
- 提供 OTLP、结构化日志和 Webhook 告警适配。
- 在完全断网环境验证签名、摘要、SBOM 和发布修订。

依赖：Phase 2 发布修订。验收：缺少任一生产证据或存在无例外 Critical 漏洞时发布失败。

## Phase 4：v0.2 GA

- 完成 v1→v2 迁移工具、兼容读取窗口和弃用提示。
- 完成数据库备份恢复、会话撤销、远程加载、Gateway 和上游故障注入。
- 完成安装、升级、回滚、离线交付和故障排查文档。
- 完成消费者契约测试、示例应用门禁和性能基线。

GA 门槛：约 50 个应用、500 个用户的单组织参考环境中，控制面查询稳定；平台完整门禁和 Todo 端到端验收通过。

## 后续候选

MFA、双人审批、WORM 审计、PostgreSQL 高可用、多租户、Git 托管适配器和跨区域容灾不属于 v0.2。
