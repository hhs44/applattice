# 后期混合仓库开发套件

## 1. 最终仓库形态

推荐的物理目录只是开发者本机工作区，不是一个 Git 仓库：

```text
testing-workspace/
├─ platform-core/                 # 本仓库
│  ├─ apps/portal                 # 统一门户
│  ├─ apps/gateway                # Gateway / BFF
│  ├─ packages/ui                 # 平台 UI 制品
│  ├─ packages/platform-sdk       # 浏览器 SDK 制品
│  ├─ platform/                   # 服务目录、契约锁、本地工作区映射
│  ├─ contracts/openapi           # 已锁定的契约快照
│  ├─ deployment                  # 平台与环境编排
│  └─ templates                   # Node / Python 独立服务模板
├─ domain-service/                # 独立 Git 仓库
├─ report-service/                # 独立 Git 仓库
└─ legacy-adapter/                # 独立 Git 仓库
```

平台仓库不保存各服务的本机路径。每位开发者复制 `platform/workspace.local.example.json` 为 `platform/workspace.local.json`，它只负责把服务 ID 映射到本地检出目录并已被 Git 忽略。

## 2. 哪些内容放在哪里

| 内容                         | 平台仓库                       | 服务仓库       | 内网制品库               |
| ---------------------------- | ------------------------------ | -------------- | ------------------------ |
| Portal、BFF、UI、浏览器 SDK  | 拥有                           | 不包含         | npm / OCI                |
| 业务规则、数据迁移、服务测试 | 不包含                         | 拥有           | OCI                      |
| OpenAPI / Event Schema       | 锁定消费者版本和摘要           | 生产并发布     | Contract/Schema Registry |
| 服务 URL、健康检查、责任人   | 服务目录                       | 清单提供初始值 | 环境配置中心             |
| 环境使用的镜像 digest        | 发布清单                       | 产生候选镜像   | OCI Registry             |
| 本机源码路径                 | `workspace.local.json`，不提交 | 无需感知平台   | 不存储                   |

一个服务满足以下任一证据再独立仓库：独立团队、独立发布、差异化扩缩容、故障隔离、不同合规权限或不同技术栈。仅仅“代码多”不是拆仓依据。

## 3. 新建并接入 Python/Node 服务

先在平台工作区生成独立仓库骨架：

```powershell
pnpm create:service report-service 报告服务 --runtime python --port 4200 --output ..\report-service
```

进入新仓库，修改 `owner`、镜像仓库和业务实现，并生成依赖锁。Python 执行 `uv lock`，Node 执行 `pnpm install`。测试和 OpenAPI 导出通过后回到平台仓库注册：

```powershell
pnpm register:service ..\report-service --owner reporting-team
pnpm contracts:verify
pnpm create:integration report-center 报告中心 --service report-service --path /api/v1/reports
```

`register:service` 会完成四件事：登记稳定服务元数据、复制并锁定消费者所见 OpenAPI、记录 SHA-256、把本机路径写入不提交的工作区文件。它不会把业务服务源码加入平台仓库。

`create:integration` 只生成 Portal 与 BFF 接入点，不再修改任一业务服务仓库。这是与早期 Monorepo 脚手架最关键的区别。

## 4. 本地联调模型

### 使用已发布镜像

```powershell
pnpm contracts:verify
pnpm hybrid:render
.\scripts\hybrid-dev.ps1 -Action up
```

### 使用多个本地源码仓库

先配置 `platform/workspace.local.json`，然后：

```powershell
pnpm hybrid:check -- --strict
.\scripts\hybrid-dev.ps1 -Action up -LocalBuild
```

工具根据服务目录生成 `.generated/hybrid.env` 和 `.generated/compose.services.yaml`。这两个文件包含机器相关路径和临时组合结果，不提交 Git。平台 Compose 与服务 Compose 分层，避免平台仓库复制每个服务的 Dockerfile。

## 5. 契约升级规则

服务仓库是契约生产者。标准流程是：

1. 在服务仓库修改实现和测试，由应用导出 OpenAPI；
2. 运行 breaking-change 检查和生产者测试，发布不可变契约制品；
3. 平台更新目标契约快照、版本和 SHA-256，执行 `pnpm contracts:verify`；
4. Gateway 使用契约生成类型或手写适配器，并运行消费者测试；
5. 先发布向后兼容的生产者，再发布消费者，最后清理旧字段。

已注册服务升级契约时执行：

```powershell
pnpm contracts:update ..\report-service --image registry.intra.example.com/testing/report-service:1.4.0
pnpm contracts:verify
```

该命令会检测路径、操作、响应、Schema、属性、必填项和枚举的结构性移除；潜在破坏性变更未提升主版本时会拒绝更新。它不能替代领域语义和消费者测试。

`pnpm contracts:lock` 只更新摘要，不代表兼容性已经通过。每次执行后都必须人工或流水线确认 SemVer 与 breaking-change 报告。

跨仓修改使用 Expand → Migrate → Contract：先增加可选字段/新端点，再迁移消费者，最后在下一个主版本删除旧契约。禁止要求多个仓库在同一时刻原子上线。

## 6. CI/CD 与发布

平台流水线只验证和构建 Portal、Gateway、共享包、服务目录、消费者契约测试及平台镜像。服务流水线独立验证代码、数据库迁移、契约兼容、SBOM、安全扫描和服务镜像。

部署不从多个仓库重新构建源码，而是消费已经验证的不可变制品：

```text
service commit -> contract version + image@sha256
platform commit -> portal@sha256 + gateway@sha256 + contracts.lock
environment release -> 上述 digest 的批准组合
```

同一环境的发布清单必须能回答：当前 Portal/Gateway 版本、每个服务镜像 digest、每个契约版本、数据库迁移状态、变更单和回滚目标。

```powershell
pnpm release:verify deployment/releases/release-manifest.production.json
.\scripts\hybrid-dev.ps1 -Action config -ReleaseManifest deployment/releases/release-manifest.production.json
```

发布清单中的所有镜像必须使用 `image@sha256:<digest>`，不能只使用可变 tag。示例文件中的零值 digest 仅展示格式，部署前必须替换成流水线实际产物。

## 7. 内网依赖实情

运行时可以完全不访问公网，但构建与治理依赖必须在内网提供：

| 依赖类别             | 内网替代                                   |
| -------------------- | ------------------------------------------ |
| Node 包              | Nexus / Artifactory / Verdaccio npm group  |
| Python 包            | 内网 PyPI、预构建 wheelhouse、uv cache     |
| 基础与应用镜像       | 内网 OCI Registry，按 digest 固定          |
| Alpine/Debian 软件包 | 内网 apk/apt 镜像或预装基础镜像            |
| OpenAPI/Event Schema | 内网通用制品库或 Schema Registry           |
| OIDC/JWKS            | 内网 SSO                                   |
| 漏洞数据、SBOM、签名 | 内网扫描器、定期审批导入的漏洞库和密钥服务 |
| 浏览器、字体、图标   | 基础镜像/静态包内置，不使用 CDN            |
| AI 模型与依赖        | 内网模型网关、模型仓库、Python wheel/容器  |

真正的断网验收不是“开发机曾经装成功”，而是在禁用公网的新环境中，只凭源码、锁文件、内网制品和离线包完成构建、启动、端到端测试与回滚。

## 8. AI 编程

根目录与每个应用/服务模板都提供了 `AGENTS.md`。AI 默认只读取任务所在仓、目标契约、失败测试和脱敏日志。跨仓问题使用 `serviceId + contractVersion + correlationId` 定位，不把所有仓库一次性加入上下文。完整约定见 `docs/context/AI-DEVELOPMENT.md`。
