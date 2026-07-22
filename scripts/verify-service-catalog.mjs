import { resolve } from 'node:path';
import {
  contractLockPath,
  exists,
  loadAppCatalog,
  loadCatalog,
  readJson,
  root,
  sha256,
} from './lib/catalog.mjs';

const catalog = await loadCatalog();
const appCatalog = await loadAppCatalog();
const lock = await readJson(contractLockPath);
if (lock.schemaVersion !== 1 || !Array.isArray(lock.contracts)) {
  throw new Error('platform/contracts.lock.json 格式不合法');
}

for (const service of catalog.services) {
  const locked = lock.contracts.find((entry) => entry.serviceId === service.id);
  if (!locked) throw new Error(`服务 ${service.id} 缺少契约锁`);
  if (locked.name !== service.contract.name || locked.version !== service.contract.version) {
    throw new Error(`服务 ${service.id} 的目录版本与契约锁不一致`);
  }
  if (locked.source !== service.contract.source) {
    throw new Error(`服务 ${service.id} 的契约来源与契约锁不一致`);
  }
  const sourcePath = resolve(root, locked.source);
  if (!(await exists(sourcePath))) throw new Error(`契约文件不存在：${locked.source}`);
  const contract = await readJson(sourcePath);
  if (contract.openapi !== '3.1.0' && contract.openapi !== '3.0.3') {
    throw new Error(`契约 ${locked.source} 不是受支持的 OpenAPI 版本`);
  }
  if (contract.info?.version !== locked.version) {
    throw new Error(`契约 ${locked.source} 的 info.version 与契约锁不一致`);
  }
  const digest = await sha256(sourcePath);
  if (locked.sha256 !== digest) {
    throw new Error(`契约 ${locked.source} 摘要已变化；确认兼容性和版本后执行 pnpm contracts:lock`);
  }
}

const unknownLocks = lock.contracts.filter(
  (entry) => !catalog.services.some((service) => service.id === entry.serviceId),
);
if (unknownLocks.length > 0) {
  throw new Error(
    `契约锁包含未注册服务：${unknownLocks.map((entry) => entry.serviceId).join(', ')}`,
  );
}

for (const app of appCatalog.apps) {
  if (!catalog.services.some((service) => service.id === app.backend.serviceId)) {
    throw new Error(`应用 ${app.id} 引用了未注册服务：${app.backend.serviceId}`);
  }
}

console.log(
  `服务目录、${appCatalog.apps.length} 个应用与 ${lock.contracts.length} 份契约锁校验通过。`,
);
