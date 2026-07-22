# 贡献指南

感谢你参与智能化测试平台开发套件。项目优先接受能够保持“统一平台治理、业务应用独立交付”边界的改进。

## 开始之前

- 普通问题和方案讨论请使用 Issue；安全问题请遵循 [SECURITY.md](SECURITY.md)，不要公开披露细节。
- 较大的架构改动建议先提交方案 Issue，说明动机、兼容性、迁移路径和验证方式。
- 贡献即表示你有权按 [Apache-2.0](LICENSE) 许可提交相关内容。

## 开发环境

必需：

- Node.js 22 或更高版本；
- pnpm 11.5.3 或更高版本，通过 Corepack 安装；
- PowerShell 7（运行仓库内的本地联调脚本时）。

涉及 Python 模板或 Todo 示例时，还需要 Python 3.12 和 uv；涉及容器验证时需要 Docker Compose。

```powershell
corepack enable
pnpm install --frozen-lockfile
pnpm contracts:verify
pnpm typecheck
pnpm test
pnpm build
pnpm format:check
```

## 仓库边界

- `apps/portal` 只承载登录、导航、主题、权限和动态模块加载，不放业务页面源码。
- 浏览器只通过 Gateway 访问业务 API；新增代理规则必须默认拒绝未声明的路径和方法。
- 独立业务应用不得依赖 `workspace:*`，跨仓共享使用版本化制品、OpenAPI、事件 Schema 或镜像。
- 修改契约时同步更新 OpenAPI 快照和 `platform/contracts.lock.json`。
- 脚手架改动必须覆盖冲突拒绝、失败回滚、无交互参数和离线模式。

更细的 AI 协作边界见 [AGENTS.md](AGENTS.md) 和 [AI 最小上下文约定](docs/context/AI-DEVELOPMENT.md)。

## 提交变更

1. 从最新主分支创建一个聚焦的特性分支。
2. 只修改当前问题需要的文件，避免混入无关格式化或生成物。
3. 为行为变化补充测试和用户文档；架构决策补充 ADR。
4. 运行与改动相关的最小测试，并在平台级改动上运行全部质量门槛。
5. 创建 Pull Request，说明问题、方案、兼容性、验证结果和截图（如果涉及界面）。

建议使用清晰的提交前缀，例如 `feat:`, `fix:`, `docs:`, `test:`, `refactor:` 和 `chore:`。

## AI 辅助贡献

可以使用 AI 辅助开发，但提交者仍对结果负责：必须人工审查代码和许可证来源，不得上传提示词中的凭据、内部地址或客户数据，并应运行与人工编写代码相同的测试和安全检查。

## Pull Request 检查

- CI、CodeQL 和契约校验通过；
- 没有提交 `.env`、本地数据库、离线缓存、构建目录或私有制品；
- 新配置提供安全默认值和示例说明；
- 新依赖说明用途，锁文件已更新；
- 破坏性变化包含迁移说明。
