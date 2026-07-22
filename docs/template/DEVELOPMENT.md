# 开发约定

## 1. 边界

依赖方向固定为：

```text
portal -> platform-sdk / ui / browser contracts -> Gateway/BFF
Gateway/BFF -> locked OpenAPI clients/adapters -> independent services
independent service -> its own domain/data -> OpenAPI or events
```

Portal 不承载业务规则，也不直连服务。Gateway 只承担认证授权、聚合、超时和防腐适配，不直接访问服务数据库。独立服务不引用平台的 `workspace:*` 包。

## 2. 平台开发

```powershell
pnpm install --frozen-lockfile
pnpm contracts:verify
pnpm dev
```

默认端口为 Portal `5173`、Gateway `4000`、兼容样例服务 `4100`。开发身份头只在 `AUTH_MODE=dev` 生效；生产配置会拒绝该模式。

## 3. 服务开发

```powershell
pnpm create:service <service-id> <名称> --runtime python|node --port <port> --output <path>
```

服务仓库必须独立拥有：责任团队、业务规则、数据库迁移、健康检查、OpenAPI、单元/集成测试、依赖锁、Dockerfile、流水线、镜像和运行手册。

服务实现与 OpenAPI 验证完成后：

```powershell
pnpm register:service <path> --owner <team>
pnpm contracts:verify
```

## 4. 门户/BFF 接入

```powershell
pnpm create:integration <feature-id> <名称> --service <service-id> --path /api/v1/<resource>
```

生成器只修改 Portal、Gateway 和权限白名单。生成代码是接入骨架，还必须补充请求/响应类型、运行时校验、权限、超时/错误映射、消费者契约测试和可观测性。

## 5. 多仓联调

镜像模式只需要服务目录和内网 OCI 镜像；源码模式还需要 `platform/workspace.local.json`：

```powershell
pnpm hybrid:check -- --strict
pnpm hybrid:render -- --local-build
.\scripts\hybrid-dev.ps1 -Action up -LocalBuild
```

所有调用传播 `x-correlation-id`。写请求必须提供幂等键或在契约中明确不可重试。大文件与传感器原始数据不穿过 Gateway，使用对象存储签名地址或独立数据平面。

## 6. 完成定义

平台改动：

```powershell
pnpm contracts:verify
pnpm typecheck
pnpm test
pnpm build
pnpm format:check
```

服务改动运行本仓库 `AGENTS.md` 和 README 中的门槛。跨仓功能还必须通过消费者契约、端到端联调、灰度和回滚验证。
