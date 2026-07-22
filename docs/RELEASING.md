# GitHub 开源发布流程

## 1. 发布前确认

- 确认代码、文档、图形素材和品牌元素具有公开授权；
- 确认 Apache-2.0 是项目所有者接受的许可证；
- 运行 `rg` 或组织认可的密钥扫描器，确保没有凭据、本机路径和客户数据；
- 确认 `.env`、数据库、缓存、离线包、私有镜像和本地工作区没有进入 Git；
- 更新 `CHANGELOG.md`、版本号和迁移说明；
- 运行完整质量门槛。

```powershell
pnpm install --frozen-lockfile
pnpm contracts:verify
pnpm release:verify deployment/releases/release-manifest.example.json
pnpm typecheck
pnpm test
pnpm build
pnpm format:check
```

Todo 示例发生变化时，额外运行：

```powershell
cd service-workspaces/todo-list-service
uv sync --locked
uv run ruff check .
uv run mypy src
uv run pytest
pnpm install --frozen-lockfile
pnpm verify
```

## 2. 创建 GitHub 仓库

建议使用描述性仓库名，例如 `applattice-kit`，默认分支使用 `main`。首次发布不要自动导入额外 README、许可证或 `.gitignore`，避免与本仓库文件冲突。

推送后在 GitHub 设置中：

- 启用 Issues，按团队需要启用 Discussions；
- 启用 Private vulnerability reporting、Secret scanning 和 Push protection；
- 启用 Dependabot alerts 与 security updates；
- pnpm 11 获得 Dependabot 版本更新支持前，不启用 npm ecosystem 自动升级任务；可使用 Dependency Graph、安全告警和人工依赖升级；
- 为 `main` 配置规则集，要求 Pull Request、CI 和 CodeQL 通过后才能合并；
- 禁止强推和删除主分支；
- 设置仓库描述、主题标签和社交预览图。

## 3. 首次发布

1. 将 `CHANGELOG.md` 中的 `Unreleased` 内容整理为目标版本。
2. 创建签名或受保护标签，例如 `v0.1.0`。
3. 在 GitHub Releases 中创建发布说明，并附上升级或迁移提示。
4. 验证从空目录克隆后仍可按 README 完成安装、门禁和脚手架生成。

当前仓库没有自动发布 npm、PyPI 或镜像；添加这些能力前，应先明确制品命名、签名、SBOM、保留策略和回滚流程。
