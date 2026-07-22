import { createWriteStream } from 'node:fs';
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { createConnection } from 'node:net';
import { dirname, resolve } from 'node:path';
import { spawn, spawnSync } from 'node:child_process';
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

const valueOf = (name, fallback) => {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : fallback;
};
const selectedAppId = valueOf('--app');
const pnpmExecutable = valueOf('--pnpm', 'pnpm');
const portalPort = Number(valueOf('--portal-port', '8080'));
const gatewayPort = Number(valueOf('--gateway-port', '4000'));
const catalog = await loadCatalog();
const appCatalog = await loadAppCatalog();
const workspace = await loadWorkspace();
const applications = selectedAppId
  ? appCatalog.apps.filter((app) => app.id === selectedAppId)
  : appCatalog.apps;
if (selectedAppId && applications.length === 0) throw new Error(`应用未注册：${selectedAppId}`);
const selectedServiceIds = new Set(applications.map((app) => app.backend.serviceId));
const services = catalog.services.filter(
  (service) =>
    !appCatalog.apps.some((app) => app.backend.serviceId === service.id) ||
    selectedServiceIds.has(service.id),
);

function portOf(url) {
  const parsed = new URL(url);
  return Number(parsed.port || (parsed.protocol === 'https:' ? 443 : 80));
}

async function assertPortFree(port, label) {
  await new Promise((resolveCheck, reject) => {
    const socket = createConnection({ host: '127.0.0.1', port });
    socket.once('connect', () => {
      socket.destroy();
      reject(new Error(`${label} 端口已占用：${port}`));
    });
    socket.once('error', () => resolveCheck());
    socket.setTimeout(500, () => {
      socket.destroy();
      resolveCheck();
    });
  });
}

const ports = [
  [portalPort, 'Portal'],
  [gatewayPort, 'Gateway'],
  ...services.map((service) => [portOf(service.gateway.developmentUrl), service.id]),
  ...applications.map((app) => [portOf(app.frontend.developmentUrl), `${app.id}-web`]),
];
if (new Set(ports.map(([port]) => port)).size !== ports.length)
  throw new Error('目录中存在重复端口');
for (const [port, label] of ports) await assertPortFree(port, label);

const temporary = resolve(root, '.tmp', 'local-platform');
const logs = resolve(temporary, 'logs');
await mkdir(logs, { recursive: true });
const children = [];
let shuttingDown = false;

function executable(name) {
  if (name === 'pnpm') return pnpmExecutable;
  return name;
}

function start(name, command, args, cwd, env = {}) {
  const log = createWriteStream(resolve(logs, `${name}.log`), { flags: 'w' });
  const child = spawn(executable(command), args, {
    cwd,
    env: { ...process.env, ...env },
    shell: process.platform === 'win32' && command === 'pnpm',
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  const pipe = (stream, target) =>
    stream.on('data', (chunk) => {
      log.write(chunk);
      target.write(`[${name}] ${chunk}`);
    });
  pipe(child.stdout, process.stdout);
  pipe(child.stderr, process.stderr);
  child.once('exit', (code) => {
    log.end();
    if (!shuttingDown) void shutdown(new Error(`${name} 提前退出，code=${code}`));
  });
  children.push({ name, child });
  return child;
}

async function waitFor(url, label, timeoutMs = 45000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      if ((await fetch(url)).ok) return;
    } catch {
      /* 尚未就绪 */
    }
    await new Promise((resolveDelay) => setTimeout(resolveDelay, 300));
  }
  throw new Error(`${label} 健康等待超时：${url}`);
}

async function shutdown(error) {
  if (shuttingDown) return;
  shuttingDown = true;
  for (const { child } of children) {
    if (child.killed || !child.pid) continue;
    if (process.platform === 'win32') {
      spawnSync('taskkill', ['/pid', String(child.pid), '/t', '/f'], { stdio: 'ignore' });
    } else {
      child.kill('SIGTERM');
    }
  }
  await rm(resolve(temporary, 'state.json'), { force: true });
  if (error) console.error(error.message);
  setTimeout(() => process.exit(error ? 1 : 0), 500);
}

for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => void shutdown());

const build = spawnSync(executable('pnpm'), ['build:packages'], {
  cwd: root,
  stdio: 'inherit',
  shell: process.platform === 'win32',
});
if (build.status !== 0) throw new Error('平台基础包构建失败');

const upstreams = {};
for (const service of services) {
  const source = serviceSource(service, workspace);
  if (!(await exists(source.path))) throw new Error(`服务源码不存在：${source.path}`);
  upstreams[service.id] = {
    baseUrl: service.gateway.developmentUrl,
    healthPath: service.gateway.healthPath,
    requestTimeoutMs: service.gateway.requestTimeoutMs,
    required: service.gateway.required,
  };
  const application = applications.find((app) => app.backend.serviceId === service.id);
  let cwd = source.path;
  if (application) {
    const combined = await readJson(
      resolve(appSource(application, workspace).path, 'platform-app.manifest.json'),
    );
    cwd = resolve(source.path, dirname(combined.backend.manifest));
  }
  if (service.runtime === 'python') {
    const python =
      process.platform === 'win32'
        ? resolve(cwd, '.venv', 'Scripts', 'python.exe')
        : resolve(cwd, '.venv', 'bin', 'python');
    if (!(await exists(python)))
      throw new Error(`${service.id} 缺少 .venv，请先执行脚手架安装或在 ${cwd} 创建环境`);
    start(service.id, python, ['-m', 'service.main'], cwd, {
      SERVICE_NAME: service.id,
      SERVICE_PORT: String(portOf(service.gateway.developmentUrl)),
    });
  } else {
    const nodeArgs =
      service.id === 'domain-service'
        ? ['--filter', '@applattice/domain-service', 'dev']
        : ['--dir', cwd, 'dev'];
    start(service.id, 'pnpm', nodeArgs, service.id === 'domain-service' ? root : cwd, {
      SERVICE_NAME: service.id,
      SERVICE_PORT: String(portOf(service.gateway.developmentUrl)),
    });
  }
  await waitFor(`${service.gateway.developmentUrl}${service.gateway.healthPath}`, service.id);
}

const runtimeApps = {};
for (const application of applications) {
  const source = appSource(application, workspace);
  const frontend = resolve(source.path, 'frontend');
  if (!(await exists(resolve(frontend, 'package.json'))))
    throw new Error(`应用前端不存在：${frontend}`);
  runtimeApps[application.id] = {
    id: application.id,
    title: application.title,
    description: application.description,
    route: application.route,
    navMark: application.navMark,
    requiredPermission: application.requiredPermission,
    frontend: { ...application.frontend, baseUrl: application.frontend.developmentUrl },
    backend: application.backend,
    permissions: application.permissions,
  };
  start(`${application.id}-web`, 'pnpm', ['dev'], frontend);
  await waitFor(
    `${application.frontend.developmentUrl}/modules/${application.id}${application.frontend.manifestPath}`,
    `${application.id}-web`,
  );
}

start('gateway', 'pnpm', ['--filter', '@applattice/gateway', 'dev'], root, {
  GATEWAY_PORT: String(gatewayPort),
  PORTAL_ORIGIN: `http://127.0.0.1:${portalPort}`,
  UPSTREAMS_JSON: JSON.stringify(upstreams),
  APP_CATALOG_JSON: JSON.stringify(runtimeApps),
});
await waitFor(`http://127.0.0.1:${gatewayPort}/health/ready`, 'Gateway');
start(
  'portal',
  'pnpm',
  ['--filter', '@applattice/portal', 'dev', '--host', '127.0.0.1', '--port', String(portalPort)],
  root,
  {
    GATEWAY_URL: `http://127.0.0.1:${gatewayPort}`,
  },
);
await waitFor(`http://127.0.0.1:${portalPort}/`, 'Portal');
await writeFile(
  resolve(temporary, 'state.json'),
  `${JSON.stringify({ pid: process.pid, portal: `http://127.0.0.1:${portalPort}`, gateway: `http://127.0.0.1:${gatewayPort}`, children: children.map(({ name, child }) => ({ name, pid: child.pid })) }, null, 2)}\n`,
  'utf8',
);
console.log(`平台已就绪：http://127.0.0.1:${portalPort}`);
await new Promise(() => {});
