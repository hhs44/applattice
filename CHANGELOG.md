# 变更日志

本项目采用 [语义化版本](https://semver.org/lang/zh-CN/)，在稳定版之前，`0.x` 版本仍可能包含不兼容调整。

## [Unreleased]

### Added

- 项目重新定义并命名为 AppLattice，聚焦“统一平台体验 + 自治业务应用”的可组合企业应用平台；
- AppLattice 产品定位、当前架构说明和 ADR-0007；
- 门户与业务应用双层脚手架；
- 三种门户布局、运行时主题和动态模块加载；
- Python FastAPI 与 Node Fastify 独立业务模板；
- Gateway 动态前端/API 代理和默认拒绝权限规则；
- Todo 全栈示例、离线制品准备、本地启动器与 Docker 配置；
- GitHub 社区文档、CI、CodeQL 和 Dependabot 配置。

### Changed

- npm 包作用域从 `@platform/*` 调整为 `@applattice/*`，并同步更新门户、Gateway、模板、锁文件和离线制品；
- 门户默认品牌、脚手架默认值、镜像示例和 Schema 标识统一为 AppLattice。

### Security

- 公开仓库敏感信息和本机路径检查；
- 明确私密漏洞报告流程和生产安全边界。
