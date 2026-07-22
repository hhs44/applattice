# 混合仓库下的 AI 编程上下文策略

项目体积不是 token 消耗的直接原因，无边界地读取文件才是。平台采用三层上下文：

1. 根 `AGENTS.md` 只说明仓库职责、最小上下文路由和统一门槛；
2. 应用或服务仓库自己的 `AGENTS.md` 说明局部边界、入口和测试命令；
3. 一次任务只附目标 OpenAPI、失败测试和相关目录，不附全部服务源码。

推荐任务描述格式：

```text
目标：在 report-service 增加报告重试。
允许修改：report-service/src、tests、contracts/openapi.json。
只读上下文：平台 contracts.lock 中 report-service@1.3.0。
验收：消费者契约测试、幂等测试、ruff/mypy/pytest 通过。
禁止：修改门户、其他服务数据库、公共基建版本。
```

跨仓问题先根据 `correlation_id` 确定失败边界，再给 AI 提供生产者契约、消费者测试和一段脱敏日志。只有证据指向平台集成时，才加载门户或 Gateway；只有证据指向业务实现时，才进入对应服务仓库。
