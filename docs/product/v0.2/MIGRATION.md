# AppLattice v0.1 → v0.2 迁移

## 迁移目标

把聚合的 `app-catalog.json`、`service-catalog.json` 和 `contracts.lock.json` 转换为按应用拆分的声明与不可变版本，同时保持应用 ID、路由、负责人、权限、服务引用、OpenAPI 版本和摘要不变。

## 迁移步骤

1. 对 v1 三份目录运行现有 `contracts:verify`，拒绝从不一致状态开始迁移。
2. 为每个应用生成 `platform/apps/<appId>/application.json` 和 `versions/<version>.json`。
3. 把服务契约锁、前端 Bridge 版本、镜像信息和部署端口写入版本声明。
4. 生成编译后的 v2 运行时快照，与 v1 Gateway 输入进行逐字段比较。
5. 在兼容窗口内同时生成 v1 聚合目录，供旧 Gateway 和脚本读取。
6. Portal/Control Plane 切换到 v2 后，保留一个小版本的 v1 只读兼容；禁止继续从 v1 注册新应用。
7. 回退时恢复 v1 生成物和旧 Gateway 配置，不修改业务应用仓库或已发布制品。

## 无损验收

- 应用、服务和契约数量一致。
- 应用 ID、路由、责任组和权限规则一致。
- OpenAPI 名称、版本、来源和 SHA-256 一致。
- 开发与容器 URL、超时和健康路径一致。
- Todo 本地联合开发、Portal 可见性和 Gateway 授权行为一致。
