# {{SERVICE_TITLE}}

这是由平台开发套件生成的独立 Node.js 服务仓库。它通过 OpenAPI、不可变镜像和 `service.manifest.json` 接入平台，不依赖平台 Monorepo 内部包。

首次初始化（在可访问内网 npm 的环境）：

```powershell
corepack enable
pnpm install
pnpm verify
```

提交前必须提交 `pnpm-lock.yaml` 和最新的 `contracts/openapi.json`。然后在平台仓库执行 `pnpm register:service -- <本仓库路径>` 完成服务目录、契约锁和本地工作区注册。
