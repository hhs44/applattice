import { copyFile, cp, mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import { root, sha256, writeJson } from '../../scripts/lib/catalog.mjs';

function run(name, args, cwd = root) {
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
    shell: process.platform === 'win32' && name === 'pnpm' && !useCurrentPnpm,
  });
  if (result.status !== 0) throw new Error(`${name} ${args.join(' ')} 执行失败`);
}

async function renderSeedFile(source, target, replacements) {
  let content = await readFile(source, 'utf8');
  for (const [token, value] of Object.entries(replacements)) {
    content = content.replaceAll(token, String(value));
  }
  await writeFile(target, content, 'utf8');
}

async function prepareBusinessLock(runtime, { output, store, cache, vendor, locks }) {
  const seed = resolve(output, `.business-seed-${runtime}`);
  await rm(seed, { recursive: true, force: true });
  await Promise.all([
    mkdir(resolve(seed, 'frontend'), { recursive: true }),
    mkdir(resolve(seed, 'backend'), { recursive: true }),
    mkdir(resolve(seed, 'vendor'), { recursive: true }),
  ]);
  const replacements = {
    __APP_ID__: 'offline-seed',
    __SERVICE_ID__: 'offline-seed-service',
    __SERVICE_TITLE__: 'Offline Seed Service',
  };
  await Promise.all([
    renderSeedFile(
      resolve(root, 'templates/business-app/common/package.json'),
      resolve(seed, 'package.json'),
      replacements,
    ),
    renderSeedFile(
      resolve(root, 'templates/business-app/common/frontend/package.json'),
      resolve(seed, 'frontend/package.json'),
      replacements,
    ),
    copyFile(
      resolve(root, 'templates/business-app/common/pnpm-workspace.yaml'),
      resolve(seed, 'pnpm-workspace.yaml'),
    ),
    cp(vendor, resolve(seed, 'vendor'), { recursive: true }),
  ]);
  if (runtime === 'node') {
    await renderSeedFile(
      resolve(root, 'templates/service-node/package.json'),
      resolve(seed, 'backend/package.json'),
      replacements,
    );
  }
  try {
    const storageArgs = ['--store-dir', store, '--cache-dir', cache];
    run('pnpm', ['install', '--lockfile-only', ...storageArgs], seed);
    run('pnpm', ['fetch', ...storageArgs], seed);
    await copyFile(resolve(seed, 'pnpm-lock.yaml'), resolve(locks, `business-app-${runtime}.yaml`));
  } finally {
    await rm(seed, { recursive: true, force: true });
  }
}

export async function prepareOfflineBundle(outputArg = 'offline-bundle', options = {}) {
  const output = resolve(root, outputArg);
  const store = resolve(output, 'pnpm-store');
  const cache = resolve(output, 'pnpm-cache');
  const vendor = resolve(output, 'vendor');
  const wheels = resolve(output, 'python-wheels');
  const locks = resolve(output, 'locks');
  const fetchWorkspace = resolve(output, '.fetch-workspace');
  await Promise.all([
    mkdir(store, { recursive: true }),
    mkdir(cache, { recursive: true }),
    mkdir(vendor, { recursive: true }),
    mkdir(wheels, { recursive: true }),
    mkdir(locks, { recursive: true }),
    mkdir(fetchWorkspace, { recursive: true }),
  ]);
  await Promise.all([
    copyFile(resolve(root, 'pnpm-lock.yaml'), resolve(fetchWorkspace, 'pnpm-lock.yaml')),
    copyFile(resolve(root, 'pnpm-workspace.yaml'), resolve(fetchWorkspace, 'pnpm-workspace.yaml')),
  ]);
  try {
    run('pnpm', ['fetch', '--store-dir', store, '--cache-dir', cache], fetchWorkspace);
  } finally {
    await rm(fetchWorkspace, { recursive: true, force: true });
  }
  run('pnpm', [
    '--filter',
    '@applattice/microfrontend-bridge',
    '--filter',
    '@applattice/ui',
    'build',
  ]);
  run('pnpm', [
    '--filter',
    '@applattice/microfrontend-bridge',
    'pack',
    '--pack-destination',
    vendor,
  ]);
  run('pnpm', ['--filter', '@applattice/ui', 'pack', '--pack-destination', vendor]);
  const vendorArtifacts = (await readdir(vendor)).filter((name) => name.endsWith('.tgz'));
  await writeJson(resolve(vendor, 'manifest.json'), {
    schemaVersion: 1,
    artifacts: await Promise.all(
      vendorArtifacts.map(async (name) => ({ name, sha256: await sha256(resolve(vendor, name)) })),
    ),
  });
  await prepareBusinessLock('python', { output, store, cache, vendor, locks });
  await prepareBusinessLock('node', { output, store, cache, vendor, locks });
  if (!options.skipPython) {
    run('python', [
      '-m',
      'pip',
      'download',
      '--dest',
      wheels,
      'hatchling>=1.27,<2.0',
      'editables>=0.3,<1.0',
      'fastapi>=0.116,<1.0',
      'pydantic-settings>=2.10,<3.0',
      'uvicorn[standard]>=0.35,<1.0',
      'httpx2>=2.7,<3.0',
      'pytest>=8.4,<9.0',
      'ruff>=0.12,<1.0',
      'mypy>=1.17,<2.0',
    ]);
  }
  const artifacts = [];
  for (const [directory, prefix] of [
    [vendor, 'vendor'],
    [wheels, 'python-wheels'],
    [locks, 'locks'],
  ]) {
    for (const name of await readdir(directory))
      artifacts.push({
        path: `${prefix}/${name}`,
        sha256: await sha256(resolve(directory, name)),
      });
  }
  await writeJson(resolve(output, 'bundle.json'), {
    schemaVersion: 1,
    createdAt: new Date().toISOString(),
    artifacts,
  });
  return output;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const output = await prepareOfflineBundle(process.argv[2] ?? 'offline-bundle', {
    skipPython: process.argv.includes('--skip-python'),
  });
  console.log(`离线包已生成：${output}`);
}
