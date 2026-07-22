import { copyFile } from 'node:fs/promises';
import { relative, resolve } from 'node:path';
import {
  catalogPath,
  contractLockPath,
  exists,
  loadCatalog,
  readJson,
  root,
  sha256,
  workspacePath,
  writeJson,
} from './lib/catalog.mjs';

const args = process.argv.slice(2);
const sourceArg = args[0];
const imageIndex = args.indexOf('--image');
const image = imageIndex >= 0 ? args[imageIndex + 1] : undefined;
if (!sourceArg) {
  console.error('用法：pnpm contracts:update <服务仓库路径> [--image registry/name:version]');
  process.exit(1);
}

const serviceDir = resolve(root, sourceArg);
const manifestPath = resolve(serviceDir, 'service.manifest.json');
if (!(await exists(manifestPath))) throw new Error(`未找到服务清单：${manifestPath}`);
const manifest = await readJson(manifestPath);
const catalog = await loadCatalog();
const service = catalog.services.find((entry) => entry.id === manifest.id);
if (!service) throw new Error(`服务尚未注册：${manifest.id}`);
if (!/^\d+\.\d+\.\d+$/.test(manifest.contract?.version ?? '')) {
  throw new Error('新契约版本必须是 SemVer');
}

const versionParts = (version) => version.split('.').map(Number);
const compareVersion = (left, right) => {
  const a = versionParts(left);
  const b = versionParts(right);
  for (let index = 0; index < 3; index += 1) {
    if (a[index] !== b[index]) return a[index] - b[index];
  }
  return 0;
};
if (compareVersion(manifest.contract.version, service.contract.version) <= 0) {
  throw new Error(
    `新契约版本 ${manifest.contract.version} 必须高于已锁定版本 ${service.contract.version}`,
  );
}

const sourceContract = resolve(serviceDir, manifest.contract.path);
if (!(await exists(sourceContract))) throw new Error(`服务契约不存在：${sourceContract}`);
const currentPath = resolve(root, service.contract.source);
const current = await readJson(currentPath);
const next = await readJson(sourceContract);
if (
  !['3.1.0', '3.0.3'].includes(next.openapi) ||
  next.info?.version !== manifest.contract.version
) {
  throw new Error('新 OpenAPI 版本或 info.version 与服务清单不一致');
}

const methods = ['get', 'put', 'post', 'delete', 'patch', 'head', 'options', 'trace'];
const breaking = [];
for (const [path, oldPath] of Object.entries(current.paths ?? {})) {
  const nextPath = next.paths?.[path];
  if (!nextPath) {
    breaking.push(`删除路径 ${path}`);
    continue;
  }
  for (const method of methods) {
    const oldOperation = oldPath?.[method];
    if (!oldOperation) continue;
    const nextOperation = nextPath[method];
    if (!nextOperation) {
      breaking.push(`删除操作 ${method.toUpperCase()} ${path}`);
      continue;
    }
    for (const status of Object.keys(oldOperation.responses ?? {})) {
      if (!nextOperation.responses?.[status]) {
        breaking.push(`删除响应 ${method.toUpperCase()} ${path} -> ${status}`);
      }
    }
  }
}

for (const [name, oldSchema] of Object.entries(current.components?.schemas ?? {})) {
  const nextSchema = next.components?.schemas?.[name];
  if (!nextSchema) {
    breaking.push(`删除 Schema ${name}`);
    continue;
  }
  for (const property of Object.keys(oldSchema.properties ?? {})) {
    if (!nextSchema.properties?.[property]) breaking.push(`删除属性 ${name}.${property}`);
  }
  const removedEnums = (oldSchema.enum ?? []).filter(
    (value) => !(nextSchema.enum ?? []).includes(value),
  );
  if (removedEnums.length > 0) breaking.push(`收窄枚举 ${name}: ${removedEnums.join(', ')}`);
  const oldRequired = new Set(oldSchema.required ?? []);
  const nextRequired = new Set(nextSchema.required ?? []);
  for (const property of oldRequired) {
    if (!nextRequired.has(property)) breaking.push(`取消必有响应属性 ${name}.${property}`);
  }
  for (const property of nextRequired) {
    if (!oldRequired.has(property)) breaking.push(`新增必填属性 ${name}.${property}`);
  }
}

const [currentMajor] = versionParts(service.contract.version);
const [nextMajor] = versionParts(manifest.contract.version);
if (breaking.length > 0 && nextMajor <= currentMajor) {
  throw new Error(
    `检测到潜在破坏性变更，必须提升主版本：\n- ${breaking.slice(0, 20).join('\n- ')}`,
  );
}

const targetContract = `contracts/openapi/${manifest.id}.v${nextMajor}.json`;
const targetPath = resolve(root, targetContract);
await copyFile(sourceContract, targetPath);
service.contract.name = manifest.contract.name;
service.contract.version = manifest.contract.version;
service.contract.source = targetContract;
if (image) service.deployment.image = image;

const lock = await readJson(contractLockPath);
const locked = lock.contracts.find((entry) => entry.serviceId === manifest.id);
if (!locked) throw new Error(`服务缺少旧契约锁：${manifest.id}`);
locked.name = manifest.contract.name;
locked.version = manifest.contract.version;
locked.source = targetContract;
locked.sha256 = await sha256(targetPath);

const workspace = (await exists(workspacePath)) ? await readJson(workspacePath) : { services: {} };
workspace.services ??= {};
workspace.services[manifest.id] = {
  path: relative(root, serviceDir).replaceAll('\\', '/'),
  source: 'local',
  dockerfile: workspace.services[manifest.id]?.dockerfile ?? 'Dockerfile',
};

await writeJson(catalogPath, catalog);
await writeJson(contractLockPath, lock);
await writeJson(workspacePath, workspace);
console.log(`服务 ${manifest.id} 契约已升级到 ${manifest.contract.version}。`);
if (breaking.length > 0) {
  console.log(`主版本升级已记录 ${breaking.length} 项潜在破坏性变更，请安排消费者迁移窗口。`);
} else {
  console.log('未检测到结构性破坏；仍需运行语义兼容和消费者测试。');
}
