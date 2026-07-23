import { copyFile, mkdir, rm } from 'node:fs/promises';
import { dirname, relative, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import {
  appCatalogPath,
  contractLockPath,
  exists,
  loadAppCatalog,
  loadCatalog,
  readJson,
  root,
  sha256,
  workspacePath,
  writeJson,
} from './lib/catalog.mjs';

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function envPrefix(id) {
  return id.replaceAll('-', '_').toUpperCase();
}

export async function registerApp(sourceArg) {
  const source = resolve(root, sourceArg);
  const manifestPath = resolve(source, 'platform-app.manifest.json');
  assert(await exists(manifestPath), `未找到联合应用清单：${manifestPath}`);
  const manifest = await readJson(manifestPath);
  assert(manifest.schemaVersion === 1, 'platform-app.manifest.json schemaVersion 必须为 1');
  assert(/^[a-z][a-z0-9-]*$/.test(manifest.id ?? ''), '应用 id 不合法');
  assert(/^\/[a-z0-9/-]*$/.test(manifest.route ?? ''), '应用 route 不合法');
  assert(
    ['python', 'node'].includes(manifest.backend?.runtime),
    '后端 runtime 仅支持 python 或 node',
  );
  assert(
    Array.isArray(manifest.permissions) && manifest.permissions.length > 0,
    '应用必须定义权限规则',
  );

  const backendManifestPath = resolve(source, manifest.backend.manifest);
  assert(await exists(backendManifestPath), `未找到后端清单：${backendManifestPath}`);
  const backendSource = dirname(backendManifestPath);
  const backend = await readJson(backendManifestPath);
  assert(backend.schemaVersion === 1, '后端清单 schemaVersion 必须为 1');
  assert(backend.runtime === manifest.backend.runtime, '联合清单与后端 runtime 不一致');
  const contractSource = resolve(dirname(backendManifestPath), backend.contract.path);
  assert(await exists(contractSource), `后端 OpenAPI 不存在：${contractSource}`);
  const openapi = await readJson(contractSource);
  assert(openapi.info?.version === backend.contract.version, 'OpenAPI 与后端清单版本不一致');

  const serviceCatalog = await loadCatalog();
  const appCatalog = await loadAppCatalog();
  const lock = await readJson(contractLockPath);
  const workspace = (await exists(workspacePath))
    ? await readJson(workspacePath)
    : { apps: {}, services: {} };
  workspace.apps ??= {};
  workspace.services ??= {};
  assert(
    !serviceCatalog.services.some((entry) => entry.id === backend.id),
    `服务已注册：${backend.id}`,
  );
  assert(!appCatalog.apps.some((entry) => entry.id === manifest.id), `应用已注册：${manifest.id}`);
  assert(
    !appCatalog.apps.some((entry) => entry.route === manifest.route),
    `门户路由已占用：${manifest.route}`,
  );
  assert(
    !appCatalog.apps.some((entry) =>
      entry.frontend.developmentUrl.endsWith(`:${manifest.frontend.port}`),
    ),
    `前端端口已占用：${manifest.frontend.port}`,
  );
  assert(
    !serviceCatalog.services.some((entry) =>
      entry.gateway.developmentUrl.endsWith(`:${backend.port}`),
    ),
    `后端端口已占用：${backend.port}`,
  );

  const major = backend.contract.version.split('.')[0];
  const contractTarget = `contracts/openapi/${backend.id}.v${major}.json`;
  const contractTargetPath = resolve(root, contractTarget);
  assert(!(await exists(contractTargetPath)), `契约目标已存在，拒绝覆盖：${contractTarget}`);

  const originalServiceCatalog = structuredClone(serviceCatalog);
  const originalAppCatalog = structuredClone(appCatalog);
  const originalLock = structuredClone(lock);
  const originalWorkspace = structuredClone(workspace);
  let contractCopied = false;
  try {
    await mkdir(dirname(contractTargetPath), { recursive: true });
    await copyFile(contractSource, contractTargetPath);
    contractCopied = true;
    const servicePrefix = envPrefix(backend.id);
    serviceCatalog.services.push({
      id: backend.id,
      title: backend.title,
      owner: manifest.owner,
      runtime: backend.runtime,
      repository: `local://${relative(root, source).replaceAll('\\', '/')}`,
      gateway: {
        baseUrlEnv: `${servicePrefix}_URL`,
        developmentUrl: `http://localhost:${backend.port}`,
        containerUrl: `http://${backend.id}:${backend.port}`,
        healthPath: backend.healthPath,
        requestTimeoutMs: 5000,
        required: true,
      },
      contract: {
        name: backend.contract.name,
        version: backend.contract.version,
        source: contractTarget,
      },
      deployment: {
        imageEnv: `${servicePrefix}_IMAGE`,
        image: backend.deployment.image,
        containerPort: backend.port,
        environment: backend.deployment.environment,
        healthcheckCommand: backend.deployment.healthcheckCommand,
      },
      development: {
        fallbackPath: `service-workspaces/${manifest.id}/${dirname(manifest.backend.manifest).replaceAll('\\', '/')}`,
        dockerfile: 'Dockerfile',
      },
    });
    serviceCatalog.services.sort((left, right) => left.id.localeCompare(right.id));

    appCatalog.apps.push({
      id: manifest.id,
      title: manifest.title,
      description: manifest.description,
      owner: manifest.owner,
      route: manifest.route,
      navMark: manifest.navMark,
      requiredPermission: manifest.requiredPermission,
      frontend: {
        version: manifest.frontend.version,
        remoteName: manifest.frontend.remoteName,
        module: './App',
        bridgeVersion: manifest.frontend.bridgeVersion,
        manifestPath: manifest.frontend.manifestPath,
        developmentUrl: `http://localhost:${manifest.frontend.port}`,
        containerUrl: `http://${manifest.id}-web:${manifest.frontend.port}`,
        requestTimeoutMs: 5000,
      },
      backend: { serviceId: backend.id, basePath: backend.apiBasePath },
      permissions: manifest.permissions,
      deployment: {
        imageEnv: `${envPrefix(manifest.id)}_WEB_IMAGE`,
        image: manifest.frontend.image,
        containerPort: manifest.frontend.port,
        dockerfile: manifest.frontend.dockerfile,
      },
      development: { fallbackPath: `service-workspaces/${manifest.id}` },
    });
    appCatalog.apps.sort((left, right) => left.id.localeCompare(right.id));

    lock.contracts.push({
      serviceId: backend.id,
      name: backend.contract.name,
      version: backend.contract.version,
      source: contractTarget,
      sha256: await sha256(contractTargetPath),
    });
    lock.contracts.sort((left, right) => left.serviceId.localeCompare(right.serviceId));
    const localPath = relative(root, source).replaceAll('\\', '/');
    workspace.apps[manifest.id] = {
      path: localPath,
      source: 'local',
      dockerfile: manifest.frontend.dockerfile,
    };
    workspace.services[backend.id] = {
      path: relative(root, backendSource).replaceAll('\\', '/'),
      source: 'local',
      dockerfile: 'Dockerfile',
    };

    await writeJson(resolve(root, 'platform/service-catalog.json'), serviceCatalog);
    await writeJson(appCatalogPath, appCatalog);
    await writeJson(contractLockPath, lock);
    await writeJson(workspacePath, workspace);
  } catch (error) {
    await writeJson(resolve(root, 'platform/service-catalog.json'), originalServiceCatalog);
    await writeJson(appCatalogPath, originalAppCatalog);
    await writeJson(contractLockPath, originalLock);
    await writeJson(workspacePath, originalWorkspace);
    if (contractCopied) await rm(contractTargetPath, { force: true });
    throw error;
  }
  return { appId: manifest.id, serviceId: backend.id, source };
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const sourceArg = process.argv[2];
  if (!sourceArg) {
    console.error('用法：pnpm register:app <全栈应用仓库路径>');
    process.exit(1);
  }
  const result = await registerApp(sourceArg);
  console.log(`已注册应用 ${result.appId} 和服务 ${result.serviceId}，并锁定 OpenAPI。`);
}
