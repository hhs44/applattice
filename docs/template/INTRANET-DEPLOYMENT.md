# 混合仓库的内网与离线部署

## 1. 内网在线构建

至少准备 Git、npm Registry、PyPI/Wheel、OCI Registry、基础镜像、企业 CA 和 OIDC。若镜像构建需要 apt/apk、浏览器、模型或漏洞数据，也必须提供内网镜像或预装基础镜像。

- npm 使用 `deployment/npmrc.internal.example`；认证令牌由用户配置或 CI Secret 注入。
- Python 配置内网 `UV_INDEX_URL`/PyPI，并优先为目标 OS/CPU 预构建 wheel。
- `NODE_IMAGE`、`NGINX_IMAGE`、`PYTHON_IMAGE`、`UV_IMAGE` 均替换为内网地址并固定 digest。
- 不用 `strict-ssl=false` 绕过证书，应把企业根 CA 安装到开发机、Runner 和基础镜像。

平台与已发布服务镜像组合启动：

```powershell
pnpm contracts:verify
.\scripts\hybrid-dev.ps1 -Action pull
.\scripts\hybrid-dev.ps1 -Action up
```

生产必须使用 `NODE_ENV=production`、`AUTH_MODE=oidc`，并让发布系统覆盖目录中的示例镜像为已批准 digest。

## 2. 完全断网运行环境

在可访问全部内网/受控上游制品的中转构建机执行：

```powershell
.\scripts\export-hybrid-offline.ps1
```

生产离线包应显式传入经过审批的发布清单：

```powershell
.\scripts\export-hybrid-offline.ps1 -ReleaseManifest deployment\releases\release-manifest.production.json
```

若要从多个本地源码检出目录构建服务镜像：

```powershell
.\scripts\export-hybrid-offline.ps1 -LocalBuild
```

离线包包含整套 OCI 镜像、平台/服务 Compose、生成的无密钥环境示例、服务目录、契约锁、导入脚本和平台 pnpm store。运行目标机只需 Docker Compose：

```powershell
.\import-offline.ps1
```

服务仓库的离线“开发”依赖由各仓库流水线单独导出：Node 输出 pnpm store，Python 输出 uv cache/wheelhouse。平台运行离线包不应携带全部服务源码或开发依赖。

若要在断网开发机继续使用双层脚手架，应在匹配目标 OS、CPU 和 Python 版本的中转机执行：

```powershell
pnpm offline:prepare .\offline-bundle
pnpm scaffold app sample "离线示例" --backend python --offline-bundle .\offline-bundle
```

开发离线包同时携带 pnpm Store、registry 元数据缓存、业务模板锁文件、平台 tgz 和 Python wheelhouse；安装阶段强制使用 pnpm `--offline` 与 pip `--no-index`。

## 3. 生产身份配置

```dotenv
NODE_ENV=production
AUTH_MODE=oidc
OIDC_ISSUER=https://sso.intra.example.com/realms/testing
OIDC_AUDIENCE=testing-platform
OIDC_JWKS_URL=https://sso.intra.example.com/realms/testing/protocol/openid-connect/certs
```

OIDC Token 至少提供稳定主体标识。角色/权限需映射到平台白名单；服务间调用使用独立工作负载身份，不复用用户长期凭据。

## 4. 断网验收

在没有公网 DNS/路由、没有开发机缓存的新环境验证：

1. 校验离线包签名、SBOM、契约锁和镜像 digest；
2. 导入镜像并启动全部必需服务；
3. 验证 Portal、Gateway readiness、OIDC、核心读写、文件/数据通道和可观测性；
4. 验证某个服务不可用时 Gateway readiness 与降级符合目录中的 `required` 设置；
5. 回滚单个服务镜像和整套发布清单；
6. 验证数据库 Schema 仍向后兼容并完成备份恢复演练。

只验证“容器能启动”不等于内网可交付；构建、扫描、签名、部署、观测、回滚和恢复都必须在目标网络边界内闭环。
