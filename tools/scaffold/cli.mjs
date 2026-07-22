import {
  copyFile,
  cp,
  mkdir,
  mkdtemp,
  readFile,
  readdir,
  rename,
  rm,
  writeFile,
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, isAbsolute, relative, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { createInterface } from 'node:readline/promises';
import { spawnSync } from 'node:child_process';
import { exists, readJson, root, sha256, writeJson } from '../../scripts/lib/catalog.mjs';
import { registerApp } from '../../scripts/register-app.mjs';

const layouts = ['enterprise-sidebar', 'modern-topnav', 'ops-console'];
const backends = ['python', 'node'];

function flagValue(args, name, fallback) {
  const index = args.indexOf(name);
  return index >= 0 ? args[index + 1] : fallback;
}

function hasFlag(args, positive, negative, fallback) {
  if (args.includes(positive)) return true;
  if (args.includes(negative)) return false;
  return fallback;
}

function command(name, args, cwd, extra = {}) {
  const useCurrentPnpm = name === 'pnpm' && process.env.npm_execpath;
  const executable = useCurrentPnpm
    ? process.execPath
    : process.platform === 'win32' && name === 'pnpm'
      ? 'pnpm.cmd'
      : name;
  const commandArgs = useCurrentPnpm ? [process.env.npm_execpath, ...args] : args;
  const result = spawnSync(executable, commandArgs, {
    cwd,
    stdio: 'inherit',
    env: { ...process.env, ...extra },
    shell: process.platform === 'win32' && name === 'pnpm' && !useCurrentPnpm,
  });
  if (result.status !== 0)
    throw new Error(
      `${name} ${args.join(' ')} 执行失败${result.error ? `：${result.error.message}` : ''}`,
    );
}

async function installCommand(args) {
  const bundleValue = flagValue(args, '--offline-bundle');
  if (!args.includes('--offline-bundle')) return { args: ['install'], env: {} };
  if (!bundleValue || bundleValue.startsWith('--'))
    throw new Error('--offline-bundle 必须指定离线包目录');
  const bundle = resolve(root, bundleValue);
  if (/[&|<>^"]/.test(bundle)) throw new Error('离线包路径包含不安全字符');
  if (!(await exists(resolve(bundle, 'pnpm-store'))))
    throw new Error(`离线包缺少 pnpm-store：${bundle}`);
  if (!(await exists(resolve(bundle, 'pnpm-cache'))))
    throw new Error(`离线包缺少 pnpm-cache：${bundle}`);
  return {
    args: [
      'install',
      '--offline',
      '--frozen-lockfile',
      '--store-dir',
      resolve(bundle, 'pnpm-store'),
      '--cache-dir',
      resolve(bundle, 'pnpm-cache'),
    ],
    env: { npm_config_offline: 'true', UV_CACHE_DIR: resolve(bundle, 'uv-cache') },
  };
}

async function installPythonBackend(args, backendDirectory) {
  command('python', ['-m', 'venv', '.venv'], backendDirectory);
  const python =
    process.platform === 'win32'
      ? resolve(backendDirectory, '.venv', 'Scripts', 'python.exe')
      : resolve(backendDirectory, '.venv', 'bin', 'python');
  const pipArgs = [
    '-m',
    'pip',
    'install',
    '--disable-pip-version-check',
    '-e',
    '.',
    'pytest>=8.4,<9.0',
    'httpx2>=2.7,<3.0',
    'ruff>=0.12,<1.0',
    'mypy>=1.17,<2.0',
  ];
  if (args.includes('--offline-bundle')) {
    const bundleValue = flagValue(args, '--offline-bundle');
    const bundle = resolve(root, bundleValue);
    pipArgs.push('--no-index', '--find-links', resolve(bundle, 'python-wheels'));
  }
  command(python, pipArgs, backendDirectory);
}

function validateId(id, kind = '项目') {
  if (!/^[a-z][a-z0-9-]*$/.test(id ?? ''))
    throw new Error(`${kind} ID 必须使用小写字母、数字和连字符`);
}

function validatePort(value, label) {
  const port = Number(value);
  if (!Number.isInteger(port) || port < 1024 || port > 65535)
    throw new Error(`${label} 必须在 1024-65535`);
  return port;
}

async function replaceTokens(directory, values) {
  const entries = await readdir(directory, { withFileTypes: true });
  for (const entry of entries) {
    const target = resolve(directory, entry.name);
    if (entry.isDirectory()) {
      await replaceTokens(target, values);
      continue;
    }
    if (/\.(tgz|png|jpg|jpeg|gif|ico|woff2?)$/i.test(entry.name)) continue;
    let content = await readFile(target, 'utf8');
    for (const [token, value] of Object.entries(values))
      content = content.replaceAll(token, String(value));
    await writeFile(target, content, 'utf8');
  }
}

async function moveIntoPlace(staging, output) {
  if (await exists(output)) throw new Error(`输出目录已存在，拒绝覆盖：${output}`);
  await mkdir(dirname(output), { recursive: true });
  for (let attempt = 0; attempt < 10; attempt += 1) {
    try {
      await rename(staging, output);
      return;
    } catch (error) {
      if (!['EPERM', 'EBUSY'].includes(error?.code) || attempt === 9) throw error;
      await new Promise((resolveDelay) => setTimeout(resolveDelay, 500));
    }
  }
}

async function promptPortal(args) {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  try {
    const id =
      args[0] ?? ((await rl.question('门户 ID [enterprise-platform]: ')) || 'enterprise-platform');
    const title =
      flagValue(args, '--title') ??
      ((await rl.question('门户名称 [企业应用平台]: ')) || '企业应用平台');
    const layout =
      flagValue(args, '--layout') ??
      ((await rl.question(`布局 ${layouts.join('|')} [enterprise-sidebar]: `)) ||
        'enterprise-sidebar');
    return { id, title, layout };
  } finally {
    rl.close();
  }
}

async function promptApp(args) {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  try {
    const id = args[0] ?? (await rl.question('应用 ID: '));
    const titleParts = args.slice(
      1,
      args.findIndex((value) => value.startsWith('--')) === -1
        ? args.length
        : args.findIndex((value) => value.startsWith('--')),
    );
    const title = titleParts.join(' ').trim() || (await rl.question('应用名称: '));
    const backend =
      flagValue(args, '--backend') ??
      ((await rl.question('后端 python|node [python]: ')) || 'python');
    return { id, title, backend };
  } finally {
    rl.close();
  }
}

const platformEntries = [
  'apps',
  'packages',
  'platform',
  'templates',
  'tools',
  'scripts',
  'deployment',
  'docs',
  'contracts',
  'package.json',
  'pnpm-workspace.yaml',
  'pnpm-lock.yaml',
  'tsconfig.base.json',
  'README.md',
  'AGENTS.md',
  'CONTRIBUTING.md',
  'SECURITY.md',
  'SUPPORT.md',
  'CODE_OF_CONDUCT.md',
  'CHANGELOG.md',
  'LICENSE',
  'NOTICE',
  '.gitignore',
  '.gitattributes',
  '.editorconfig',
  '.dockerignore',
  '.env.example',
  '.prettierignore',
  '.prettierrc.json',
  '.npmrc',
];

function platformTemplateFilter(source) {
  const ignored = new Set(['node_modules', 'dist', '.generated', '.tmp', '.venv', '__pycache__']);
  return !source.split(/[\\/]/).some((part) => ignored.has(part));
}

export async function scaffoldPortal(args) {
  const interactive =
    args.length === 0 ||
    (!args[0]?.startsWith('-') && !flagValue(args, '--title') && process.stdin.isTTY);
  const answers = interactive
    ? await promptPortal(args)
    : {
        id: args[0],
        title: flagValue(args, '--title'),
        layout: flagValue(args, '--layout', 'enterprise-sidebar'),
      };
  validateId(answers.id, '门户');
  if (!answers.title) throw new Error('门户名称不能为空');
  if (!layouts.includes(answers.layout)) throw new Error(`布局仅支持：${layouts.join(', ')}`);
  const output = resolve(root, flagValue(args, '--output', `generated/${answers.id}`));
  const portalPort = validatePort(flagValue(args, '--portal-port', '8080'), 'Portal 端口');
  const gatewayPort = validatePort(flagValue(args, '--gateway-port', '4000'), 'Gateway 端口');
  if (portalPort === gatewayPort) throw new Error('Portal 和 Gateway 端口不能相同');
  const defaultTheme = flagValue(args, '--default-theme', 'light');
  const themes = flagValue(args, '--themes', 'light,dark,system').split(',');
  const primaryColor = flagValue(args, '--primary-color', '#1672e5');
  if (!['light', 'dark', 'system'].includes(defaultTheme)) throw new Error('默认主题不合法');
  if (
    themes.some((theme) => !['light', 'dark', 'system'].includes(theme)) ||
    !themes.includes(defaultTheme)
  ) {
    throw new Error('可用主题不合法，且必须包含默认主题');
  }
  if (!/^#[0-9a-fA-F]{6}$/.test(primaryColor)) throw new Error('品牌色必须是六位十六进制颜色');
  if (args.includes('--dry-run'))
    return { kind: 'portal', id: answers.id, output, layout: answers.layout };
  if (await exists(output)) throw new Error(`输出目录已存在，拒绝覆盖：${output}`);

  await mkdir(dirname(output), { recursive: true });
  const temporaryRoot = await mkdtemp(resolve(dirname(output), `.${answers.id}-scaffold-`));
  let moved = false;
  try {
    for (const entry of platformEntries) {
      const source = resolve(root, entry);
      if (await exists(source))
        await cp(source, resolve(temporaryRoot, entry), {
          recursive: true,
          filter: platformTemplateFilter,
        });
    }
    const serviceCatalog = await readJson(resolve(temporaryRoot, 'platform/service-catalog.json'));
    serviceCatalog.services = serviceCatalog.services.filter(
      (entry) => entry.id === 'domain-service',
    );
    await writeJson(resolve(temporaryRoot, 'platform/service-catalog.json'), serviceCatalog);
    await writeJson(resolve(temporaryRoot, 'platform/app-catalog.json'), {
      $schema: './app-catalog.schema.json',
      schemaVersion: 1,
      apps: [],
    });
    const lock = await readJson(resolve(temporaryRoot, 'platform/contracts.lock.json'));
    lock.contracts = lock.contracts.filter((entry) => entry.serviceId === 'domain-service');
    await writeJson(resolve(temporaryRoot, 'platform/contracts.lock.json'), lock);
    await writeJson(resolve(temporaryRoot, 'platform/workspace.local.json'), {
      apps: {},
      services: {},
    });
    await rm(resolve(temporaryRoot, 'contracts/openapi/todo-list-service.v1.json'), {
      force: true,
    });
    await rm(resolve(temporaryRoot, 'service-workspaces'), { recursive: true, force: true });
    const sourceLayout = resolve(temporaryRoot, 'templates/portal-layouts', answers.layout);
    const targetLayouts = resolve(temporaryRoot, 'apps/portal/src/layouts');
    await rm(targetLayouts, { recursive: true, force: true });
    await mkdir(resolve(targetLayouts, answers.layout), { recursive: true });
    await cp(sourceLayout, resolve(targetLayouts, answers.layout), { recursive: true });
    const portalConfigPath = resolve(temporaryRoot, 'apps/portal/public/portal.config.json');
    const portalConfig = await readJson(portalConfigPath);
    Object.assign(portalConfig, {
      title: answers.title,
      layout: answers.layout,
      defaultTheme,
      themes,
      primaryColor,
    });
    const serializedPortalConfig = JSON.stringify(
      { ...portalConfig, themes: '__PORTAL_THEMES__' },
      null,
      2,
    ).replace(
      '"themes": "__PORTAL_THEMES__"',
      `"themes": [${themes.map((theme) => JSON.stringify(theme)).join(', ')}]`,
    );
    await writeFile(portalConfigPath, `${serializedPortalConfig}\n`, 'utf8');
    const packagePath = resolve(temporaryRoot, 'package.json');
    const packageManifest = await readJson(packagePath);
    Object.assign(packageManifest, {
      name: answers.id,
      description: `${answers.title}门户、Gateway 与业务应用脚手架`,
    });
    await writeJson(packagePath, packageManifest);
    const appPath = resolve(temporaryRoot, 'apps/portal/src/App.tsx');
    await writeFile(
      appPath,
      (await readFile(appPath, 'utf8')).replaceAll('enterprise-sidebar', answers.layout),
      'utf8',
    );
    const stylesPath = resolve(temporaryRoot, 'apps/portal/src/styles.css');
    await writeFile(
      stylesPath,
      (await readFile(stylesPath, 'utf8')).replaceAll('enterprise-sidebar', answers.layout),
      'utf8',
    );
    const vitePath = resolve(temporaryRoot, 'apps/portal/vite.config.ts');
    await writeFile(
      vitePath,
      (await readFile(vitePath, 'utf8'))
        .replace('port: 8080', `port: ${portalPort}`)
        .replace('port: 5173', `port: ${portalPort}`)
        .replaceAll('http://localhost:4000', `http://localhost:${gatewayPort}`),
      'utf8',
    );
    const gatewayConfigPath = resolve(temporaryRoot, 'apps/gateway/src/config.ts');
    await writeFile(
      gatewayConfigPath,
      (await readFile(gatewayConfigPath, 'utf8'))
        .replace('env.GATEWAY_PORT ?? 4000', `env.GATEWAY_PORT ?? ${gatewayPort}`)
        .replace('http://localhost:5173', `http://localhost:${portalPort}`),
      'utf8',
    );
    await moveIntoPlace(temporaryRoot, output);
    moved = true;
    if (hasFlag(args, '--install', '--skip-install', true)) {
      const install = await installCommand(args);
      command('pnpm', install.args, output, install.env);
    }
    return { kind: 'portal', id: answers.id, output, layout: answers.layout };
  } catch (error) {
    await rm(moved ? output : temporaryRoot, { recursive: true, force: true });
    throw error;
  }
}

async function packPlatformVendors(target) {
  command(
    'pnpm',
    ['--filter', '@applattice/microfrontend-bridge', '--filter', '@applattice/ui', 'build'],
    root,
  );
  await mkdir(target, { recursive: true });
  command(
    'pnpm',
    ['--filter', '@applattice/microfrontend-bridge', 'pack', '--pack-destination', target],
    root,
  );
  command('pnpm', ['--filter', '@applattice/ui', 'pack', '--pack-destination', target], root);
  const artifacts = (await readdir(target)).filter((name) => name.endsWith('.tgz'));
  await writeJson(resolve(target, 'manifest.json'), {
    schemaVersion: 1,
    artifacts: await Promise.all(
      artifacts.map(async (name) => ({ name, sha256: await sha256(resolve(target, name)) })),
    ),
  });
}

export async function scaffoldApp(args) {
  const interactive = args.length === 0 || (!flagValue(args, '--backend') && process.stdin.isTTY);
  const answers = interactive
    ? await promptApp(args)
    : { id: args[0], title: args[1], backend: flagValue(args, '--backend', 'python') };
  validateId(answers.id, '应用');
  if (!answers.title) throw new Error('应用名称不能为空');
  if (!backends.includes(answers.backend)) throw new Error('后端仅支持 python 或 node');
  const webPort = validatePort(flagValue(args, '--web-port', '4300'), '前端端口');
  const apiPort = validatePort(flagValue(args, '--api-port', '4200'), '后端端口');
  if (webPort === apiPort) throw new Error('前端和后端端口不能相同');
  const owner = flagValue(args, '--owner', 'platform-team');
  const route = flagValue(args, '--route', `/${answers.id}`);
  const database = flagValue(args, '--database', 'sqlite');
  const example = flagValue(args, '--example', 'crud');
  if (!/^\/[a-z0-9/-]*$/.test(route)) throw new Error('门户路由不合法');
  if (!['sqlite', 'none'].includes(database)) throw new Error('database 仅支持 sqlite 或 none');
  if (!['crud', 'none'].includes(example)) throw new Error('example 仅支持 crud 或 none');
  if (example === 'crud' && database === 'none') throw new Error('CRUD 示例需要 SQLite');
  if (example === 'none' && database === 'sqlite')
    throw new Error('无示例模式请使用 --database none');
  const output = resolve(root, flagValue(args, '--output', `service-workspaces/${answers.id}`));
  if (args.includes('--dry-run'))
    return { kind: 'app', id: answers.id, output, backend: answers.backend };
  if (await exists(output)) throw new Error(`输出目录已存在，拒绝覆盖：${output}`);
  await mkdir(dirname(output), { recursive: true });
  const staging = await mkdtemp(resolve(dirname(output), `.${answers.id}-scaffold-`));
  let moved = false;
  try {
    await cp(resolve(root, 'templates/business-app/common'), staging, { recursive: true });
    await copyFile(resolve(root, 'LICENSE'), resolve(staging, 'LICENSE'));
    await copyFile(resolve(root, 'NOTICE'), resolve(staging, 'NOTICE'));
    await copyFile(resolve(root, '.gitattributes'), resolve(staging, '.gitattributes'));
    await copyFile(resolve(root, '.editorconfig'), resolve(staging, '.editorconfig'));
    const backendTemplate = resolve(root, 'templates', `service-${answers.backend}`);
    await cp(backendTemplate, resolve(staging, 'backend'), { recursive: true });
    if (example === 'none') {
      await cp(
        resolve(root, 'templates/business-app/frontend-empty/App.tsx'),
        resolve(staging, 'frontend/src/App.tsx'),
      );
      await cp(
        resolve(root, 'templates/business-app/no-example/platform-app.manifest.json'),
        resolve(staging, 'platform-app.manifest.json'),
      );
      await cp(
        resolve(root, 'templates/business-app/no-example/deployment/compose.yaml'),
        resolve(staging, 'deployment/compose.yaml'),
      );
      await cp(
        resolve(root, 'templates/business-app/backend-empty', answers.backend),
        resolve(staging, 'backend'),
        { recursive: true },
      );
      if (answers.backend === 'python') {
        await rm(resolve(staging, 'backend/src/service/models.py'), { force: true });
        await rm(resolve(staging, 'backend/src/service/repository.py'), { force: true });
      }
    }
    if (args.includes('--offline-bundle')) {
      const bundleValue = flagValue(args, '--offline-bundle');
      if (!bundleValue || bundleValue.startsWith('--'))
        throw new Error('--offline-bundle 必须指定离线包目录');
      const bundle = resolve(root, bundleValue);
      const bundledVendor = resolve(bundle, 'vendor');
      const bundledLock = resolve(bundle, 'locks', `business-app-${answers.backend}.yaml`);
      if (!(await exists(bundledVendor))) throw new Error(`离线包缺少平台 vendor：${bundle}`);
      if (!(await exists(bundledLock)))
        throw new Error(`离线包缺少 ${answers.backend} 业务锁文件：${bundle}`);
      await cp(bundledVendor, resolve(staging, 'vendor'), { recursive: true });
      await copyFile(bundledLock, resolve(staging, 'pnpm-lock.yaml'));
    } else {
      await packPlatformVendors(resolve(staging, 'vendor'));
    }
    await replaceTokens(staging, {
      __APP_ID__: answers.id,
      __APP_TITLE__: answers.title,
      '{{APP_TITLE}}': answers.title,
      __APP_DESCRIPTION__: `${answers.title} 独立全栈应用`,
      __APP_ROUTE__: route,
      __APP_NAV_MARK__: answers.title.slice(0, 1),
      __APP_OWNER__: owner,
      __REMOTE_NAME__: `${answers.id.replaceAll('-', '_')}_app`,
      __WEB_PORT__: webPort,
      '"__WEB_PORT_NUMBER__"': webPort,
      __API_PORT__: apiPort,
      __SERVICE_ID__: `${answers.id}-service`,
      __SERVICE_TITLE__: `${answers.title}服务`,
      '{{SERVICE_TITLE}}': `${answers.title}服务`,
      __PORT__: apiPort,
      '"__PORT_NUMBER__"': apiPort,
      __BACKEND_RUNTIME__: answers.backend,
    });
    await moveIntoPlace(staging, output);
    moved = true;
    if (hasFlag(args, '--install', '--skip-install', true)) {
      const install = await installCommand(args);
      command('pnpm', install.args, output, install.env);
      if (answers.backend === 'python') {
        await installPythonBackend(args, resolve(output, 'backend'));
      }
    }
    if (hasFlag(args, '--register', '--no-register', true))
      await registerApp(isAbsolute(output) ? output : relative(root, output));
    return { kind: 'app', id: answers.id, output, backend: answers.backend };
  } catch (error) {
    if (moved) await rm(output, { recursive: true, force: true });
    else await rm(staging, { recursive: true, force: true });
    throw error;
  }
}

export async function runCli(argv = process.argv.slice(2)) {
  const [kind, ...args] = argv;
  if (kind === 'portal') return scaffoldPortal(args);
  if (kind === 'app') return scaffoldApp(args);
  throw new Error('用法：pnpm scaffold portal|app [参数]');
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try {
    const result = await runCli();
    console.log(`[scaffold] ${result.kind} ${result.id}: ${relative(root, result.output)}`);
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  }
}
