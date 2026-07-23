# AppLattice v0.2 产品定义

## 1. 产品目标

AppLattice v0.2 将项目从“可运行的门户与应用模板”推进为可治理的企业应用平台。它面向平台管理员、应用负责人、应用开发者、安全审计员和最终用户，在不收回业务仓库自治权的前提下，统一应用声明、身份、权限、版本、发布证据和故障视图。

核心承诺保持不变：**让应用保持自治，让平台保持统一。**

### 成功指标

- 在准备好的内网环境中，新应用从脚手架生成到完成注册验证不超过 30 分钟。
- 新增应用不要求修改 Portal 业务源码，浏览器始终只访问 Gateway。
- 所有未声明的 API 方法、路径和权限默认拒绝。
- 单个远程应用加载失败不会导致 Portal 或其他应用白屏。
- 生产发布 100% 固定制品摘要，并关联签名、SBOM、漏洞报告、变更单和回滚目标。
- 应用、版本和部署历史可按责任人、时间、关联 ID 和 Git 修订追溯。

## 2. 用户与关键旅程

| 用户       | 目标               | v0.2 关键路径                                             |
| ---------- | ------------------ | --------------------------------------------------------- |
| 平台管理员 | 建立统一治理基线   | 配置身份源、角色、兼容策略和发布规则                      |
| 应用负责人 | 管理应用版本与风险 | 查看健康、验证结果、发布提案、回滚和下线窗口              |
| 应用开发者 | 低摩擦接入平台     | `scaffold → doctor → validate → register → dev → publish` |
| 安全审计员 | 复核授权和发布证据 | 查询角色绑定、审计记录、签名、SBOM 和漏洞例外             |
| 最终用户   | 稳定使用自治应用   | 统一登录、导航、权限和故障降级体验                        |

## 3. 产品边界

### 包含

- GitOps 应用控制面、应用/版本/部署三层生命周期和兼容矩阵。
- 单组织内建 IAM：本地账号、OIDC 联邦、组、角色、作用域绑定和服务端会话。
- Portal 控制面体验、Gateway 默认拒绝式授权和统一审计。
- CLI、离线验证、制品摘要、签名、CycloneDX SBOM 和漏洞门禁。
- 健康、远程加载错误、Gateway 链路、审计与告警适配。

### 不包含

- 多租户、跨区域容灾、Kubernetes 控制器或完整 PaaS。
- AppLattice 作为第三方系统的 OIDC Provider。
- 自建 Git 托管、制品仓库、漏洞数据库或完整可观测平台。
- 业务数据、业务规则、业务数据库和业务服务 SLO 的所有权。
- v0.2 强制 MFA、双人审批或 WORM 审计；这些作为后续增强项。

## 4. 控制面架构

正式运行时新增独立 Control Plane/IAM 服务。浏览器继续只访问 Gateway；Portal 不直连 Control Plane、业务服务、Git 或 PostgreSQL。

| 事实域                               | 权威来源                  | 写入者                         | 消费者                      |
| ------------------------------------ | ------------------------- | ------------------------------ | --------------------------- |
| 应用、版本、兼容策略、环境发布修订   | 平台 Git 仓库             | 本地 CLI + 人工评审            | CI、Control Plane、发布系统 |
| 用户、外部身份、组、角色、绑定、会话 | PostgreSQL                | Control Plane/IAM API          | Gateway、Portal 管理界面    |
| 健康观测与审计                       | PostgreSQL/外部可观测系统 | Gateway、Portal、Control Plane | Portal、告警适配器、审计员  |
| 业务规则与数据                       | 独立业务应用              | 业务团队                       | 仅经公开 API/事件访问       |

Control Plane 只读取经过 CI 验证的 Git 快照，不允许数据库反向覆盖声明。应用治理写操作通过 CLI 生成本地差异，由组织现有 PR/MR 流程提交；IAM 管理操作通过版本化 REST API 执行。

架构图见 [v0.2-control-plane.mmd](../../architecture/v0.2-control-plane.mmd) 和对应 Draw.io 文件。

## 5. 生命周期

生命周期按不同所有权拆分，禁止用一个状态同时表达应用存续、版本验证和环境部署：

```ts
type ApplicationStatus = 'active' | 'deprecated' | 'archived';
type VersionStatus = 'registered' | 'validating' | 'validated' | 'rejected' | 'superseded';
type DeploymentStatus = 'pending' | 'deploying' | 'healthy' | 'degraded' | 'failed' | 'rolled_back';
```

- 创建和开发仅存在于应用仓库；注册合并后才产生平台应用和不可变版本。
- 发布只能引用 `validated` 版本，并创建新的环境部署修订。
- 升级发布更新后的已验证版本；旧版本保留并可作为回滚目标。
- 回滚创建指向旧版本的新修订，不覆盖失败修订，不修改版本历史。
- 归档要求无活动部署；归档后禁止新发布，但保留声明、版本和审计。

完整状态图见 [v0.2-app-lifecycle.mmd](../../architecture/v0.2-app-lifecycle.mmd)。

## 6. 公共接口

### 数据契约

`@applattice/contracts` 定义 `Application`、`ApplicationVersion`、`DeploymentRevision`、`CompatibilityResult`、`User`、`ExternalIdentity`、`Group`、`Role`、`RoleBinding`、`Session`、`AuditEvent` 和 `HealthObservation`。Demo 与未来 HTTP Repository 共用这些契约。

### REST API

浏览器侧接口统一位于 Gateway 后的 `/api/control/v1`：

| 方法与路径                       | 用途                           | 权限                            |
| -------------------------------- | ------------------------------ | ------------------------------- |
| `GET /apps`、`GET /apps/:id`     | 查询应用、版本、部署和兼容结果 | `platform:audit` 或应用读取权限 |
| `GET /health`、`GET /audit`      | 查询健康观测和审计             | `platform:audit`                |
| `GET/POST/PATCH /users`          | 管理平台用户状态               | `platform:admin`                |
| `GET/POST/PATCH /groups`         | 管理本地组与 OIDC 组映射       | `platform:admin`                |
| `GET/POST/PATCH /roles`          | 管理角色和权限集合             | `platform:admin`                |
| `GET/POST/DELETE /role-bindings` | 管理平台级或应用级绑定         | `platform:admin` 或应用管理员   |

应用注册、发布、回滚和归档不提供直接数据库写接口；API 只返回声明状态、提案预览和 Git/CI 结果。

### CLI

正式命令统一为：

```text
applattice scaffold|doctor|validate|register|dev|publish|rollback
```

所有命令支持 `--json`、`--dry-run` 和稳定退出码。`register`、`publish`、`rollback` 只生成并验证本地 Git 变更，不自动提交或调用特定 Git 托管 API。现有 `pnpm scaffold`、`pnpm register:app` 和 `pnpm local:dev` 在兼容窗口内保留。

## 7. 协议兼容治理

兼容矩阵覆盖 Bridge、SDK、UI、Manifest Schema、OpenAPI 和平台版本，统一输出：

- `supported`：允许验证和发布。
- `deprecated`：仍可发布，但必须给出升级窗口和修复建议。
- `blocked`：禁止生成生产发布提案。

Bridge 和 Manifest 以主版本作为运行时边界；SDK/UI 使用 SemVer 范围；OpenAPI 对比上一已验证版本，破坏性变化必须升级契约主版本。每个结果必须包含稳定原因码、当前值、要求值和修复建议。

## 8. 可观测与故障治理

- Portal 上报远程模块加载耗时、失败类别和应用 ID，不上报业务载荷。
- Gateway 生成或传播关联 ID，记录授权结论、上游延迟和稳定错误码。
- Control Plane 汇总应用、前端、Gateway 和服务健康观察，并通过 OTLP、结构化日志或 Webhook 对接现有平台。
- 远程应用失败显示应用级降级页；Control Plane/IAM 不可用时鉴权失败关闭。
- 审计事件至少包含时间、主体、动作、目标、结果、关联 ID 和脱敏说明。

## 9. 安全与供应链

- 本地密码使用 Argon2id；会话使用服务端不透明 ID和 `Secure`、`HttpOnly`、`SameSite=Lax` Cookie，并配置 CSRF 防护。
- 生产环境继续拒绝 `AUTH_MODE=dev`；开发模式必须显式启用并记录审计。
- 生产制品固定 digest，使用 Cosign 自管密钥签名，附带 CycloneDX 1.7 JSON SBOM、漏洞报告和离线包摘要。
- Critical 漏洞无有效例外时阻断；例外必须包含负责人、理由和到期时间。
- 参考 [OWASP Password Storage](https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html)、[OWASP Session Management](https://cheatsheetseries.owasp.org/cheatsheets/Session_Management_Cheat_Sheet.html)、[Sigstore](https://docs.sigstore.dev/cosign/verifying/verify/) 和 [CycloneDX](https://cyclonedx.org/specification/overview/)。

## 10. 高保真原型

Portal 的 `/control` 功能通过 `ControlPlaneRepository` 读取数据。`controlPlane.mode` 支持 `disabled | mock | http`；仓库样例使用 `mock`，正式部署在后端就绪前应设为 `disabled`。

原型覆盖概览、应用治理、应用详情、开发者路径、IAM、发布与回滚、审计和六种确定性故障场景。所有 Mock 操作均明确标识，不写 Git、不创建会话、不触发部署。
