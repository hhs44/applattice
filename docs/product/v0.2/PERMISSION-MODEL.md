# AppLattice v0.2 身份与权限模型

## 1. 边界与原则

- 每套部署服务一个组织；v0.2 不引入租户 ID。
- AppLattice 管理本地账号、OIDC 外部身份关联、组、角色、绑定和会话，但不向第三方系统提供 OIDC Provider 能力。
- Gateway 是浏览器 API 的唯一授权执行点，未声明的方法、路径和权限默认拒绝。
- 应用负责人是可授权的组，不使用自由文本负责人承担安全语义。
- 角色只聚合权限；角色绑定把用户或组、角色与平台/应用作用域连接起来。

## 2. 权威数据模型

| 实体             | 关键字段                                    | 约束                                  |
| ---------------- | ------------------------------------------- | ------------------------------------- |
| User             | `id`、`username`、`email`、`status`         | 一个自然人一个平台用户                |
| ExternalIdentity | `providerId`、`subject`、`userId`           | `(providerId, subject)` 唯一          |
| Group            | `id`、`name`、`source`                      | `source = local                       | oidc`        |
| GroupMember      | `groupId`、`userId`                         | OIDC 组由登录同步，本地组由管理员维护 |
| Role             | `id`、`scope`、`permissions`                | `scope = platform                     | application` |
| RoleBinding      | `subject`、`roleId`、`scope`、`appId?`      | 应用作用域必须提供 `appId`            |
| Session          | 随机不透明 ID摘要、`userId`、到期与撤销时间 | 原始会话 ID不写日志                   |
| AuditEvent       | 主体、动作、目标、结果、关联 ID             | 追加写入，业务 API 不允许修改         |

正式实现使用 PostgreSQL 迁移管理 Schema。密码哈希与会话数据只存在数据库和密钥边界内，不进入 Git、Manifest、日志或前端存储。

## 3. 认证流程

### 本地账号

1. Portal 将用户名、密码和 CSRF Token 发送到 Gateway 的认证端点。
2. Control Plane/IAM 使用 Argon2id 验证密码，执行账号状态、失败次数和锁定检查。
3. 成功后创建服务端会话，返回 `__Host-applattice_session` Cookie。
4. Gateway 通过内部会话内省接口获取用户、角色和权限，允许最多 30 秒缓存。

### 企业 OIDC 联邦

1. Control Plane 生成 `state`、`nonce` 和 PKCE，发起 Authorization Code 流程。
2. 回调验证 issuer、audience、签名、nonce 和 code verifier。
3. 以 `(providerId, subject)` 关联唯一平台用户；邮箱仅作展示和待确认匹配，不作为稳定主键。
4. OIDC 组按允许列表映射到平台组，再创建统一服务端会话。

Control Plane/IAM 不可用时 Gateway 对受保护接口失败关闭。登录、回调和健康端点使用独立允许列表。

## 4. 授权模型

权限保持 `resource:action` 格式：

- 平台权限：`platform:admin`、`platform:audit`。
- 应用权限：`<appId>:read`、`<appId>:write`、`<appId>:admin`。
- Gateway API 规则继续声明 `methods + pathPrefix + permission`。

平台级角色可以包含平台权限；应用级角色在绑定时必须给出 `appId`，其动作扩展为目标应用权限。一个主体的有效权限是所有有效用户绑定与组绑定的并集；显式停用用户和撤销会话优先于允许规则。

内建角色：

| 角色       | 作用域 | 默认能力                               |
| ---------- | ------ | -------------------------------------- |
| 平台管理员 | 平台   | IAM、兼容策略和全部审计管理            |
| 审计员     | 平台   | 只读查看控制面、授权和发布证据         |
| 应用负责人 | 应用   | 目标应用读取、写入、发布提案和成员授权 |
| 应用开发者 | 应用   | 目标应用读取、写入和验证结果           |
| 应用查看者 | 应用   | 目标应用和健康状态只读                 |

## 5. 开发模式

- `AUTH_MODE=dev` 仅允许非生产环境，生产启动时强制拒绝。
- 开发身份默认获得目录中声明的应用权限和 `platform:admin`，仅用于本地原型与联调。
- 开发请求头不能在 OIDC/正式本地会话模式下改变身份。
- 页面必须显示开发/Mock 标识，相关操作写入开发审计或明确标记为未持久化。

## 6. 管理 API 与审计

IAM 管理 API 位于 `/api/control/v1/users|groups|roles|role-bindings`。写操作要求幂等键、CSRF 防护、稳定错误码和审计事件。高风险操作至少包括停用用户、撤销会话、授予平台管理员和修改 OIDC Provider。

审计默认保留 180 天并支持导出；v0.2 不承诺 WORM。日志可以记录会话 ID的加盐摘要用于关联，但不得记录原始 Cookie、密码、OIDC Token 或完整敏感载荷。
