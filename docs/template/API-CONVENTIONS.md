# 跨仓 API 与事件约定

## 契约所有权

业务服务仓库拥有并从实现导出 OpenAPI；平台仓库只锁定消费者实际使用的版本与 SHA-256。TypeScript Zod/Python Pydantic/客户端代码都应由相同 OpenAPI 生成或进行一致性测试，禁止跨语言手工维护两套“事实来源”。

## HTTP

- 业务接口使用 `/api/v<major>`；健康检查使用 `/health/live` 和 `/health/ready`。
- Gateway 生成或透传 `x-correlation-id`，服务日志和下游调用必须继续传播。
- 写请求使用 `Idempotency-Key`，或在 OpenAPI 明确不可安全重试。
- 统一错误至少包含稳定 `code`、可读 `message`、`correlationId` 和可选 `details`。
- 明确连接/响应超时、重试条件、分页、限流和最大载荷；不得无限重试。
- 新字段先可选，删除/改名/收窄类型提升主版本；遵循 Expand → Migrate → Contract。

## 身份与授权

浏览器只向 Gateway 提交企业身份。Gateway 验证 OIDC，并向服务传递最小必要主体信息或内部服务令牌。服务必须执行领域级授权，不信任来自浏览器的模拟身份头。开发身份模式禁止进入生产。

## 事件

事件必须包含 `event_id`、`event_type`、`schema_version`、`occurred_at`、`correlation_id` 和业务聚合 ID。消费者按至少一次投递设计，处理重复、乱序、毒消息与重放。事件 Schema 由生产者拥有并在内网 Schema Registry 执行兼容门禁。

## 数据与文件

一个业务实体只有一个写入服务。跨域更新通过公开 API/事件，不直接写其他服务数据库。大文件、日志包和传感器数据通过对象存储或数据平面传输，API 只承载元数据、授权和任务状态。
