import { mkdir, writeFile } from 'node:fs/promises';
import { relative, resolve } from 'node:path';
import * as prettier from 'prettier';
import {
  appSource,
  exists,
  loadAppCatalog,
  loadCatalog,
  loadWorkspace,
  readJson,
  root,
  serviceSource,
} from './lib/catalog.mjs';

const localBuild = process.argv.includes('--local-build');
const releaseIndex = process.argv.indexOf('--release');
const releasePath = releaseIndex >= 0 ? process.argv[releaseIndex + 1] : undefined;
const catalog = await loadCatalog();
const appCatalog = await loadAppCatalog();
const workspace = await loadWorkspace();
const release = releasePath ? await readJson(resolve(root, releasePath)) : undefined;
if (release && localBuild) throw new Error('--release 与 --local-build 不能同时使用');
const outputDir = resolve(root, '.generated');
await mkdir(outputDir, { recursive: true });

const upstreams = {};
const runtimeApps = {};
const envLines = ['# 此文件由 pnpm hybrid:render 生成，请勿提交。'];
const compose = [
  '# 此文件由 pnpm hybrid:render 生成，请勿提交。',
  'services:',
  '  gateway:',
  '    depends_on:',
];

for (const service of catalog.services) {
  upstreams[service.id] = {
    baseUrl: service.gateway.containerUrl,
    healthPath: service.gateway.healthPath,
    requestTimeoutMs: service.gateway.requestTimeoutMs,
    required: service.gateway.required,
  };
  const releasedService = release?.services?.find((entry) => entry.id === service.id);
  if (release && !releasedService) throw new Error(`发布清单缺少服务：${service.id}`);
  if (releasedService && releasedService.contractVersion !== service.contract.version) {
    throw new Error(`发布清单中 ${service.id} 的契约版本与服务目录不一致`);
  }
  envLines.push(
    `${service.deployment.imageEnv}=${releasedService?.image ?? service.deployment.image}`,
  );
  compose.push(`      ${service.id}:`);
  compose.push('        condition: service_healthy');
}

for (const application of appCatalog.apps) {
  runtimeApps[application.id] = {
    id: application.id,
    title: application.title,
    description: application.description,
    route: application.route,
    navMark: application.navMark,
    requiredPermission: application.requiredPermission,
    frontend: {
      version: application.frontend.version,
      remoteName: application.frontend.remoteName,
      module: application.frontend.module,
      bridgeVersion: application.frontend.bridgeVersion,
      manifestPath: application.frontend.manifestPath,
      baseUrl: application.frontend.containerUrl,
      requestTimeoutMs: application.frontend.requestTimeoutMs,
    },
    backend: application.backend,
    permissions: application.permissions,
  };
  envLines.push(`${application.deployment.imageEnv}=${application.deployment.image}`);
  compose.push(`      ${application.id}-web:`);
  compose.push('        condition: service_healthy');
}

for (const service of catalog.services) {
  compose.push(`  ${service.id}:`);
  compose.push(`    image: \${${service.deployment.imageEnv}:-${service.deployment.image}}`);
  if (localBuild) {
    const source = serviceSource(service, workspace);
    if (!(await exists(source.path))) {
      throw new Error(`服务 ${service.id} 的本地源码目录不存在：${source.path}`);
    }
    if (!(await exists(resolve(source.path, source.dockerfile)))) {
      throw new Error(
        `服务 ${service.id} 的 Dockerfile 不存在：${resolve(source.path, source.dockerfile)}`,
      );
    }
    compose.push('    build:');
    compose.push(`      context: ${JSON.stringify(source.path.replaceAll('\\', '/'))}`);
    compose.push(`      dockerfile: ${JSON.stringify(source.dockerfile.replaceAll('\\', '/'))}`);
  }
  compose.push('    environment:');
  for (const [key, value] of Object.entries(service.deployment.environment)) {
    compose.push(`      ${key}: ${JSON.stringify(value)}`);
  }
  compose.push('    networks: [platform]');
  compose.push('    healthcheck:');
  compose.push(`      test: ${JSON.stringify(service.deployment.healthcheckCommand)}`);
  compose.push('      interval: 10s');
  compose.push('      timeout: 3s');
  compose.push('      retries: 6');
  compose.push('      start_period: 10s');
  compose.push('    restart: unless-stopped');
}

for (const application of appCatalog.apps) {
  compose.push(`  ${application.id}-web:`);
  compose.push(
    `    image: \${${application.deployment.imageEnv}:-${application.deployment.image}}`,
  );
  if (localBuild) {
    const source = appSource(application, workspace);
    if (!(await exists(source.path))) {
      throw new Error(`应用 ${application.id} 的本地源码目录不存在：${source.path}`);
    }
    if (!(await exists(resolve(source.path, source.dockerfile)))) {
      throw new Error(
        `应用 ${application.id} 的 Dockerfile 不存在：${resolve(source.path, source.dockerfile)}`,
      );
    }
    compose.push('    build:');
    compose.push(`      context: ${JSON.stringify(source.path.replaceAll('\\', '/'))}`);
    compose.push(`      dockerfile: ${JSON.stringify(source.dockerfile.replaceAll('\\', '/'))}`);
  }
  compose.push('    networks: [platform]');
  compose.push('    healthcheck:');
  compose.push(
    `      test: ${JSON.stringify([
      'CMD',
      'wget',
      '-qO-',
      `http://127.0.0.1:${application.deployment.containerPort}/modules/${application.id}${application.frontend.manifestPath}`,
    ])}`,
  );
  compose.push('      interval: 10s');
  compose.push('      timeout: 3s');
  compose.push('      retries: 6');
  compose.push('      start_period: 5s');
  compose.push('    restart: unless-stopped');
}

if (release) {
  if (!release.platform?.portalImage || !release.platform?.gatewayImage) {
    throw new Error('发布清单缺少 Portal 或 Gateway 镜像');
  }
  envLines.push(`PORTAL_IMAGE=${release.platform.portalImage}`);
  envLines.push(`GATEWAY_IMAGE=${release.platform.gatewayImage}`);
}
envLines.push(`UPSTREAMS_JSON=${JSON.stringify(upstreams)}`);
envLines.push(`APP_CATALOG_JSON=${JSON.stringify(runtimeApps)}`);
await writeFile(resolve(outputDir, 'hybrid.env'), `${envLines.join('\n')}\n`, 'utf8');
await writeFile(
  resolve(outputDir, 'compose.services.yaml'),
  await prettier.format(`${compose.join('\n')}\n`, {
    parser: 'yaml',
    printWidth: 100,
    singleQuote: true,
    trailingComma: 'all',
  }),
  'utf8',
);

console.log(`已生成 ${relative(root, resolve(outputDir, 'hybrid.env'))}`);
console.log(`已生成 ${relative(root, resolve(outputDir, 'compose.services.yaml'))}`);
console.log(
  localBuild
    ? '服务将从本地检出目录构建。'
    : release
      ? '服务与平台将使用发布清单中固定到 digest 的镜像。'
      : '服务将使用目录中登记的镜像。',
);
