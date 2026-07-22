import { copyFile, mkdir } from 'node:fs/promises';
import { dirname, relative, resolve } from 'node:path';
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
const valueOf = (flag, fallback) => {
  const index = args.indexOf(flag);
  return index >= 0 ? args[index + 1] : fallback;
};
if (!sourceArg) {
  console.error(
    '用法：pnpm register:service <服务仓库路径> [--owner team] [--repository ssh://...] [--image registry/...:version]',
  );
  process.exit(1);
}

const serviceDir = resolve(root, sourceArg);
const manifestPath = resolve(serviceDir, 'service.manifest.json');
if (!(await exists(manifestPath))) throw new Error(`未找到服务清单：${manifestPath}`);
const manifest = await readJson(manifestPath);
if (manifest.schemaVersion !== 1 || !/^[a-z][a-z0-9-]*$/.test(manifest.id ?? '')) {
  throw new Error('service.manifest.json 的 schemaVersion 或 id 不合法');
}
if (!['node', 'python', 'external'].includes(manifest.runtime)) {
  throw new Error(`服务 runtime 不受支持：${manifest.runtime}`);
}
if (!Number.isInteger(manifest.port) || manifest.port < 1 || manifest.port > 65535) {
  throw new Error('服务端口不合法');
}
if (!manifest.title || !manifest.healthPath?.startsWith('/')) {
  throw new Error('服务 title 或 healthPath 不合法');
}
if (
  !manifest.deployment ||
  !Array.isArray(manifest.deployment.healthcheckCommand) ||
  manifest.deployment.healthcheckCommand.length < 2
) {
  throw new Error('服务 deployment.healthcheckCommand 不合法');
}
if (!/^\d+\.\d+\.\d+$/.test(manifest.contract?.version ?? '')) {
  throw new Error('服务契约版本必须是 SemVer');
}
const sourceContract = resolve(serviceDir, manifest.contract.path);
if (!(await exists(sourceContract))) throw new Error(`服务契约不存在：${sourceContract}`);
const openapi = await readJson(sourceContract);
if (
  !['3.1.0', '3.0.3'].includes(openapi.openapi) ||
  openapi.info?.version !== manifest.contract.version
) {
  throw new Error('服务 OpenAPI 版本或 info.version 与清单不一致');
}

const catalog = await loadCatalog();
if (catalog.services.some((service) => service.id === manifest.id)) {
  throw new Error(`服务已注册，拒绝隐式覆盖：${manifest.id}`);
}
const owner = valueOf('--owner', manifest.owner);
const repository = valueOf('--repository', manifest.repository);
const image = valueOf('--image', manifest.deployment?.image);
if (!owner || owner === 'CHANGE_ME') throw new Error('请通过 --owner 或服务清单设置真实责任团队');
if (!repository || !image) throw new Error('服务 repository 或 deployment.image 缺失');

const envPrefix = manifest.id.replaceAll('-', '_').toUpperCase();
const major = manifest.contract.version.split('.')[0];
const targetContract = `contracts/openapi/${manifest.id}.v${major}.json`;
const targetContractPath = resolve(root, targetContract);
await mkdir(dirname(targetContractPath), { recursive: true });
await copyFile(sourceContract, targetContractPath);

catalog.services.push({
  id: manifest.id,
  title: manifest.title,
  owner,
  runtime: manifest.runtime,
  repository,
  gateway: {
    baseUrlEnv: `${envPrefix}_URL`,
    developmentUrl: `http://localhost:${manifest.port}`,
    containerUrl: `http://${manifest.id}:${manifest.port}`,
    healthPath: manifest.healthPath,
    requestTimeoutMs: 5000,
    required: true,
  },
  contract: {
    name: manifest.contract.name,
    version: manifest.contract.version,
    source: targetContract,
  },
  deployment: {
    imageEnv: `${envPrefix}_IMAGE`,
    image,
    containerPort: manifest.port,
    environment: manifest.deployment.environment ?? { SERVICE_PORT: String(manifest.port) },
    healthcheckCommand: manifest.deployment.healthcheckCommand,
  },
  development: {
    fallbackPath: `service-workspaces/${manifest.id}`,
    dockerfile: 'Dockerfile',
  },
});
catalog.services.sort((left, right) => left.id.localeCompare(right.id));

const lock = await readJson(contractLockPath);
lock.contracts.push({
  serviceId: manifest.id,
  name: manifest.contract.name,
  version: manifest.contract.version,
  source: targetContract,
  sha256: await sha256(targetContractPath),
});
lock.contracts.sort((left, right) => left.serviceId.localeCompare(right.serviceId));

const workspace = (await exists(workspacePath)) ? await readJson(workspacePath) : { services: {} };
workspace.services ??= {};
workspace.services[manifest.id] = {
  path: relative(root, serviceDir).replaceAll('\\', '/'),
  source: 'local',
  dockerfile: 'Dockerfile',
};

await writeJson(catalogPath, catalog);
await writeJson(contractLockPath, lock);
await writeJson(workspacePath, workspace);
console.log(`已注册服务 ${manifest.id}，并锁定契约摘要。`);
console.log('请提交服务目录、契约副本和契约锁；workspace.local.json 不应提交。');
