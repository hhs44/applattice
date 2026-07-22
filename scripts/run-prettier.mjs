import { spawnSync } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const mode = process.argv[2];

if (!['--check', '--write'].includes(mode)) {
  console.error('用法：node scripts/run-prettier.mjs --check|--write');
  process.exit(2);
}

const tracked = spawnSync('git', ['ls-files', '--cached', '--others', '--exclude-standard', '-z'], {
  cwd: root,
  encoding: 'utf8',
  maxBuffer: 10 * 1024 * 1024,
});

if (tracked.status !== 0) {
  process.stderr.write(tracked.stderr || '无法读取 Git 文件列表。\n');
  process.exit(tracked.status ?? 1);
}

const files = tracked.stdout.split('\0').filter(Boolean);
const prettier = resolve(root, 'node_modules/prettier/bin/prettier.cjs');
const batches = [];
let batch = [];
let commandLength = 0;

for (const file of files) {
  if (batch.length > 0 && commandLength + file.length > 12_000) {
    batches.push(batch);
    batch = [];
    commandLength = 0;
  }
  batch.push(file);
  commandLength += file.length + 3;
}
if (batch.length > 0) batches.push(batch);

for (const current of batches) {
  const result = spawnSync(process.execPath, [prettier, mode, '--ignore-unknown', ...current], {
    cwd: root,
    stdio: 'inherit',
  });
  if (result.status !== 0) process.exit(result.status ?? 1);
}
