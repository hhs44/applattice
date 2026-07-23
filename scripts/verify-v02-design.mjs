import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const required = [
  'docs/product/v0.2/PRODUCT-DEFINITION.md',
  'docs/product/v0.2/PERMISSION-MODEL.md',
  'docs/product/v0.2/BACKLOG.md',
  'docs/product/v0.2/MIGRATION.md',
  'docs/architecture/v0.2-control-plane.mmd',
  'docs/architecture/v0.2-app-lifecycle.mmd',
  'docs/architecture/v0.2-control-plane.drawio',
  'docs/architecture/v0.2-app-lifecycle.drawio',
];

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

for (const relativePath of required) {
  const content = await readFile(resolve(root, relativePath), 'utf8');
  assert(content.trim().length > 0, `${relativePath} 为空`);
  if (relativePath.endsWith('.mmd')) {
    assert(/^flowchart\s+(LR|TB)/m.test(content), `${relativePath} 缺少 Mermaid flowchart 声明`);
    assert(!content.includes('```'), `${relativePath} 不应包含 Markdown fence`);
  }
  if (relativePath.endsWith('.drawio')) {
    assert(
      content.includes('<mxfile') && content.includes('<mxGraphModel'),
      `${relativePath} 不是 Draw.io XML`,
    );
    const ids = new Set([...content.matchAll(/\bid="([^"]+)"/g)].map((match) => match[1]));
    const references = [...content.matchAll(/\b(?:source|target)="([^"]+)"/g)].map(
      (match) => match[1],
    );
    const broken = references.filter((reference) => !ids.has(reference));
    assert(broken.length === 0, `${relativePath} 存在断链引用: ${[...new Set(broken)].join(', ')}`);
  }
}

console.log(
  `AppLattice v0.2 设计制品校验通过，共 ${required.length} 个文件，Draw.io BrokenReferences: 0。`,
);
