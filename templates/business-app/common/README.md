# {{APP_TITLE}}

这是由平台脚手架生成的独立全栈业务仓库。前端既有独立开发壳，也通过 `./App` 暴露给统一门户；后端只能由 Gateway 的 `/api/apps/__APP_ID__/*` 访问。

## 本地开发

```powershell
pnpm install
pnpm --dir frontend dev
```

后端请参照 `backend/README.md`。在平台仓库执行 `pnpm register:app <本目录>` 完成注册；联合注册来源只有 `platform-app.manifest.json`。

完整门禁：

```powershell
pnpm verify
```

Python 后端还应在 `backend` 目录运行 `.venv\Scripts\ruff.exe check .`、`.venv\Scripts\mypy.exe src` 和 `.venv\Scripts\python.exe -m pytest`。
