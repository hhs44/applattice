import { spawn } from 'node:child_process';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const workspace = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const children = [];

function cleanEnvironment(extra = {}) {
  const entries = Object.entries(process.env).filter(([key]) => key.toLowerCase() !== 'path');
  return {
    ...Object.fromEntries(entries),
    PATH: process.env.PATH ?? process.env.Path ?? '',
    ...extra,
  };
}

function start(name, args, cwd, env = {}) {
  const child = spawn(process.execPath, args, {
    cwd,
    env: cleanEnvironment(env),
    stdio: ['ignore', 'pipe', 'pipe'],
    windowsHide: true,
  });
  child.stdout.on('data', (chunk) => process.stdout.write(`[${name}] ${chunk}`));
  child.stderr.on('data', (chunk) => process.stderr.write(`[${name}] ${chunk}`));
  children.push(child);
  return child;
}

async function waitUntilReady(url) {
  for (let attempt = 0; attempt < 50; attempt += 1) {
    try {
      const response = await fetch(url);
      if (response.ok) return;
    } catch {
      // 服务仍在启动。
    }
    await new Promise((resolvePromise) => setTimeout(resolvePromise, 200));
  }
  throw new Error(`服务未在 10 秒内就绪：${url}`);
}

start('domain', ['dist/server.js'], join(workspace, '.tmp', 'domain-release'), {
  NODE_ENV: 'production',
});
start('gateway', ['dist/server.js'], join(workspace, '.tmp', 'gateway-release'), {
  NODE_ENV: 'development',
  AUTH_MODE: 'dev',
  DOMAIN_SERVICE_URL: 'http://127.0.0.1:4100',
});
start(
  'portal',
  [
    join(workspace, 'apps', 'portal', 'node_modules', 'vite', 'bin', 'vite.js'),
    'preview',
    '--port',
    '8080',
    '--host',
    '127.0.0.1',
  ],
  join(workspace, 'apps', 'portal'),
);

try {
  await waitUntilReady('http://127.0.0.1:8080/health/ready');
  const holdMilliseconds = Number(process.env.VERIFY_HOLD_MS ?? 0);
  if (holdMilliseconds > 0) {
    console.log(`验证服务已就绪，将保持 ${holdMilliseconds}ms。`);
    await new Promise((resolvePromise) => setTimeout(resolvePromise, holdMilliseconds));
  } else {
    process.env.PLATFORM_URL = 'http://127.0.0.1:8080';
    await import('./smoke-test.mjs');
  }
} finally {
  for (const child of children.reverse()) {
    await new Promise((resolvePromise) => {
      if (child.exitCode !== null) return resolvePromise();
      child.once('exit', resolvePromise);
      child.kill();
    });
  }
}
