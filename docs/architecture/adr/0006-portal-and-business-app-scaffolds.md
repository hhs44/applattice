# ADR-0006：门户壳与业务全栈应用使用双层脚手架

- 状态：Accepted
- 日期：2026-07-21

## 决策

平台提供统一入口 `pnpm scaffold portal|app`。Portal 脚手架生成门户壳、Gateway、目录、桥接包、三选一布局和开发工具；App 脚手架生成独立 React/Vite 远程前端及 Python FastAPI 或 Node Fastify 后端。

业务前端不进入门户仓库。门户只根据用户权限读取应用目录，并经 Gateway 同源加载 `/modules/:appId/*`。浏览器访问业务 API 只能使用 `/api/apps/:appId/*`；Gateway 按联合应用清单中的方法、路径前缀和权限规则授权，没有匹配规则时拒绝。

`platform-app.manifest.json` 是应用注册唯一来源。注册同时更新应用目录、服务目录、OpenAPI 契约锁和本地工作区映射；任一步失败都回滚。

React 与 ReactDOM 由门户和远程模块共享，`@platform/microfrontend-bridge` 的主版本用于运行时兼容校验。远程模块加载必须有超时、重试和错误边界，单个应用故障不能使门户白屏。

## 后果

- 平台与业务可以独立迭代、测试和发布，AI 编程时也能只加载单个业务仓库上下文。
- 平台必须维护版本化桥接/UI tgz、应用目录和 Gateway 通用代理。
- 远程前端必须遵守 CSS 令牌与 `PlatformAppProps`，不得直连后端地址。
- 本地开发优先使用目录启动器；Docker 与离线包是同一清单的派生能力。
