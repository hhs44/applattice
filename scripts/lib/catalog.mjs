import { createHash } from 'node:crypto';
import { access, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const root = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
export const catalogPath = resolve(root, 'platform', 'service-catalog.json');
export const appCatalogPath = resolve(root, 'platform', 'app-catalog.json');
export const contractLockPath = resolve(root, 'platform', 'contracts.lock.json');
export const workspacePath = resolve(root, 'platform', 'workspace.local.json');

export async function readJson(path) {
  return JSON.parse(await readFile(path, 'utf8'));
}

export async function writeJson(path, value) {
  await writeFile(path, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

export async function exists(path) {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

export function validateCatalog(catalog) {
  assert(catalog?.schemaVersion === 1, '服务目录 schemaVersion 必须为 1');
  assert(Array.isArray(catalog.services), '服务目录缺少 services 数组');
  const ids = new Set();
  const baseUrlEnvs = new Set();
  const imageEnvs = new Set();

  for (const service of catalog.services) {
    const prefix = `服务 ${service?.id ?? '<unknown>'}`;
    assert(/^[a-z][a-z0-9-]*$/.test(service?.id ?? ''), `${prefix} 的 id 不合法`);
    assert(!ids.has(service.id), `${prefix} 重复注册`);
    ids.add(service.id);
    assert(typeof service.title === 'string' && service.title.length > 0, `${prefix} 缺少 title`);
    assert(typeof service.owner === 'string' && service.owner.length > 0, `${prefix} 缺少 owner`);
    assert(['node', 'python', 'external'].includes(service.runtime), `${prefix} runtime 不受支持`);
    assert(
      typeof service.repository === 'string' && service.repository.length > 0,
      `${prefix} 缺少 repository`,
    );

    const gateway = service.gateway;
    assert(gateway && typeof gateway === 'object', `${prefix} 缺少 gateway`);
    assert(/^[A-Z][A-Z0-9_]*$/.test(gateway.baseUrlEnv ?? ''), `${prefix} baseUrlEnv 不合法`);
    assert(!baseUrlEnvs.has(gateway.baseUrlEnv), `${prefix} baseUrlEnv 重复`);
    baseUrlEnvs.add(gateway.baseUrlEnv);
    for (const field of ['developmentUrl', 'containerUrl']) {
      assert(/^https?:\/\//.test(gateway[field] ?? ''), `${prefix} ${field} 必须是 HTTP URL`);
    }
    assert(gateway.healthPath?.startsWith('/'), `${prefix} healthPath 必须以 / 开头`);
    assert(
      Number.isInteger(gateway.requestTimeoutMs) && gateway.requestTimeoutMs >= 100,
      `${prefix} requestTimeoutMs 不合法`,
    );
    assert(typeof gateway.required === 'boolean', `${prefix} required 必须是布尔值`);

    const contract = service.contract;
    assert(contract && typeof contract === 'object', `${prefix} 缺少 contract`);
    assert(
      typeof contract.name === 'string' && contract.name.length > 0,
      `${prefix} contract.name 缺失`,
    );
    assert(
      /^\d+\.\d+\.\d+$/.test(contract.version ?? ''),
      `${prefix} contract.version 必须是 SemVer`,
    );
    assert(
      typeof contract.source === 'string' && contract.source.length > 0,
      `${prefix} contract.source 缺失`,
    );
    assert(
      /^contracts\/openapi\/[a-z0-9.-]+\.json$/.test(contract.source),
      `${prefix} contract.source 必须位于 contracts/openapi`,
    );

    const deployment = service.deployment;
    assert(deployment && typeof deployment === 'object', `${prefix} 缺少 deployment`);
    assert(/^[A-Z][A-Z0-9_]*$/.test(deployment.imageEnv ?? ''), `${prefix} imageEnv 不合法`);
    assert(!imageEnvs.has(deployment.imageEnv), `${prefix} imageEnv 重复`);
    imageEnvs.add(deployment.imageEnv);
    assert(
      typeof deployment.image === 'string' && deployment.image.length > 0,
      `${prefix} image 缺失`,
    );
    assert(
      Number.isInteger(deployment.containerPort) &&
        deployment.containerPort > 0 &&
        deployment.containerPort <= 65535,
      `${prefix} containerPort 不合法`,
    );
    assert(
      deployment.environment && typeof deployment.environment === 'object',
      `${prefix} environment 缺失`,
    );
    assert(
      Array.isArray(deployment.healthcheckCommand) && deployment.healthcheckCommand.length >= 2,
      `${prefix} healthcheckCommand 缺失`,
    );

    const development = service.development;
    assert(development && typeof development === 'object', `${prefix} 缺少 development`);
    assert(
      typeof development.fallbackPath === 'string' && development.fallbackPath.length > 0,
      `${prefix} fallbackPath 缺失`,
    );
    assert(
      typeof development.dockerfile === 'string' && development.dockerfile.length > 0,
      `${prefix} dockerfile 缺失`,
    );
  }
  return catalog;
}

export function validateAppCatalog(catalog) {
  assert(catalog?.schemaVersion === 1, '应用目录 schemaVersion 必须为 1');
  assert(Array.isArray(catalog.apps), '应用目录缺少 apps 数组');
  const ids = new Set();
  const routes = new Set();
  const remoteNames = new Set();
  for (const app of catalog.apps) {
    const prefix = `应用 ${app?.id ?? '<unknown>'}`;
    assert(/^[a-z][a-z0-9-]*$/.test(app?.id ?? ''), `${prefix} id 不合法`);
    assert(!ids.has(app.id), `${prefix} 重复注册`);
    ids.add(app.id);
    assert(typeof app.title === 'string' && app.title.length > 0, `${prefix} 缺少 title`);
    assert(
      typeof app.description === 'string' && app.description.length > 0,
      `${prefix} 缺少 description`,
    );
    assert(/^\/[a-z0-9/-]*$/.test(app.route ?? ''), `${prefix} route 不合法`);
    assert(!routes.has(app.route), `${prefix} route 重复`);
    routes.add(app.route);
    assert(
      /^[a-z][a-z0-9-]*:[a-z][a-z0-9-]*$/.test(app.requiredPermission ?? ''),
      `${prefix} requiredPermission 不合法`,
    );
    const frontend = app.frontend;
    assert(frontend && typeof frontend === 'object', `${prefix} 缺少 frontend`);
    assert(
      /^\d+\.\d+\.\d+$/.test(frontend.version ?? ''),
      `${prefix} frontend.version 必须是 SemVer`,
    );
    assert(/^[a-z][a-z0-9_]*$/.test(frontend.remoteName ?? ''), `${prefix} remoteName 不合法`);
    assert(!remoteNames.has(frontend.remoteName), `${prefix} remoteName 重复`);
    remoteNames.add(frontend.remoteName);
    assert(frontend.module === './App', `${prefix} 只允许暴露 ./App`);
    assert(
      /^\d+\.\d+\.\d+$/.test(frontend.bridgeVersion ?? ''),
      `${prefix} bridgeVersion 必须是 SemVer`,
    );
    assert(frontend.manifestPath?.startsWith('/'), `${prefix} manifestPath 不合法`);
    for (const field of ['developmentUrl', 'containerUrl']) {
      assert(/^https?:\/\//.test(frontend[field] ?? ''), `${prefix} ${field} 必须是 HTTP URL`);
    }
    assert(
      Number.isInteger(frontend.requestTimeoutMs) && frontend.requestTimeoutMs >= 100,
      `${prefix} requestTimeoutMs 不合法`,
    );
    assert(app.backend?.basePath?.startsWith('/'), `${prefix} backend.basePath 不合法`);
    assert(
      /^[a-z][a-z0-9-]*$/.test(app.backend?.serviceId ?? ''),
      `${prefix} backend.serviceId 不合法`,
    );
    assert(
      Array.isArray(app.permissions) && app.permissions.length > 0,
      `${prefix} 缺少 permissions`,
    );
    for (const rule of app.permissions) {
      assert(
        Array.isArray(rule.methods) && rule.methods.length > 0,
        `${prefix} 权限规则缺少 methods`,
      );
      assert(rule.pathPrefix?.startsWith('/'), `${prefix} 权限规则 pathPrefix 不合法`);
      assert(
        /^[a-z][a-z0-9-]*:[a-z][a-z0-9-]*$/.test(rule.permission ?? ''),
        `${prefix} 权限规则 permission 不合法`,
      );
    }
  }
  return catalog;
}

export async function loadCatalog() {
  return validateCatalog(await readJson(catalogPath));
}

export async function loadAppCatalog() {
  return validateAppCatalog(await readJson(appCatalogPath));
}

export async function loadWorkspace() {
  if (!(await exists(workspacePath))) return { services: {}, apps: {} };
  const workspace = await readJson(workspacePath);
  if (!workspace.services || typeof workspace.services !== 'object') {
    throw new Error('platform/workspace.local.json 缺少 services 对象');
  }
  workspace.apps ??= {};
  return workspace;
}

export function serviceSource(service, workspace) {
  const override = workspace.services[service.id];
  const path = resolve(root, override?.path ?? service.development.fallbackPath);
  const dockerfile = override?.dockerfile ?? service.development.dockerfile;
  return { path, dockerfile, overridden: Boolean(override) };
}

export function appSource(app, workspace) {
  const override = workspace.apps?.[app.id];
  const path = resolve(root, override?.path ?? app.development.fallbackPath);
  const dockerfile = override?.dockerfile ?? app.deployment.dockerfile;
  return { path, dockerfile, overridden: Boolean(override) };
}

export async function sha256(path) {
  const data = await readFile(path);
  return createHash('sha256').update(data).digest('hex');
}
