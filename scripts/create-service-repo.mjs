import { copyFile, cp, mkdir, readdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { exists, root } from './lib/catalog.mjs';

const args = process.argv.slice(2);
const id = args[0];
const firstFlag = args.findIndex((value) => value.startsWith('--'));
const title = args
  .slice(1, firstFlag === -1 ? args.length : firstFlag)
  .join(' ')
  .trim();
const valueOf = (flag, fallback) => {
  const index = args.indexOf(flag);
  return index >= 0 ? args[index + 1] : fallback;
};
const runtime = valueOf('--runtime', 'python');
const portText = valueOf('--port', runtime === 'python' ? '4200' : '4300');
const outputText = valueOf('--output', `service-workspaces/${id ?? 'service'}`);
const port = Number(portText);

if (!id || !/^[a-z][a-z0-9-]*$/.test(id) || !title) {
  console.error(
    '用法：pnpm create:service <service-id> <名称> --runtime python|node [--port 4200] [--output path]',
  );
  process.exit(1);
}
if (!['python', 'node'].includes(runtime)) throw new Error('--runtime 仅支持 python 或 node');
if (!Number.isInteger(port) || port < 1024 || port > 65535)
  throw new Error('--port 必须在 1024-65535');

const source = resolve(root, 'templates', `service-${runtime}`);
const output = resolve(root, outputText);
if (output === root || output === dirname(root)) throw new Error('输出目录不能是工作区或其父目录');
if (await exists(output)) throw new Error(`输出目录已存在，拒绝覆盖：${output}`);

await mkdir(dirname(output), { recursive: true });
await cp(source, output, { recursive: true, errorOnExist: true });
await copyFile(resolve(root, 'LICENSE'), resolve(output, 'LICENSE'));
await copyFile(resolve(root, 'NOTICE'), resolve(output, 'NOTICE'));
await copyFile(resolve(root, '.gitattributes'), resolve(output, '.gitattributes'));
await copyFile(resolve(root, '.editorconfig'), resolve(output, '.editorconfig'));

async function replaceDirectory(path) {
  const entries = await readdir(path, { withFileTypes: true });
  for (const entry of entries) {
    const target = resolve(path, entry.name);
    if (entry.isDirectory()) {
      await replaceDirectory(target);
      continue;
    }
    const content = await readFile(target, 'utf8');
    await writeFile(
      target,
      content
        .replaceAll('__SERVICE_ID__', id)
        .replaceAll('__APP_ID__', id.replace(/-service$/, ''))
        .replaceAll('__SERVICE_TITLE__', title)
        .replaceAll('{{SERVICE_TITLE}}', title)
        .replaceAll('"__PORT_NUMBER__"', String(port))
        .replaceAll('__PORT__', String(port)),
      'utf8',
    );
  }
}

await replaceDirectory(output);
console.log(`已生成独立 ${runtime} 服务仓库骨架：${relative(root, output)}`);
console.log('下一步：初始化依赖锁、运行测试，再执行 pnpm register:service -- <路径>。');
