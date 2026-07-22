# 开源发布检查表

## 已在仓库中落实

- [x] Apache-2.0 许可证和 NOTICE；
- [x] 贡献、安全、支持、行为准则和变更日志；
- [x] Issue 与 Pull Request 模板；
- [x] GitHub Actions 质量门禁和 CodeQL；
- [x] GitHub Actions 与 uv 的 Dependabot 配置；pnpm 11 先使用 Dependency Graph 与安全告警；
- [x] 常见凭据、本机路径和生成物排查；
- [x] 官方 Todo 示例纳入版本控制，其他本地业务仓库继续忽略；
- [x] 跨平台换行约定和扩展忽略规则。

## 仓库所有者发布前完成

- [ ] 确认许可证、版权主体、品牌和架构图片的公开授权；
- [x] 选择 GitHub 组织和最终仓库名：`hhs44/applattice`；
- [x] 确定仓库地址后补充 `package.json` 的 `repository`、`homepage` 和 `bugs` 字段；
- [x] 启用 GitHub 私密漏洞报告作为安全联系渠道；
- [x] 启用 GitHub 安全功能和主分支规则集；
- [x] 确认示例中的 `*.intra.example.com` 只作为占位符，不含真实基础设施信息；
- [x] 通过 GitHub Actions 从全新 checkout 执行完整门禁；
- [ ] 创建首个签名标签和 GitHub Release。
