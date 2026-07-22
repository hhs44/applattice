import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadCatalog } from './lib/catalog.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const slug = args[0];
const flagIndex = args.findIndex((value) => value.startsWith('--'));
const titleParts = args.slice(1, flagIndex === -1 ? args.length : flagIndex);
const title = titleParts.join(' ').trim();
const valueOf = (flag, fallback) => {
  const index = args.indexOf(flag);
  return index >= 0 ? args[index + 1] : fallback;
};
const serviceId = valueOf('--service');
const upstreamPath = valueOf('--path', `/api/v1/${slug ?? ''}`);

if (!slug || !/^[a-z][a-z0-9-]*$/.test(slug) || !title || !serviceId) {
  console.error(
    '用法：pnpm create:integration <kebab-case-id> <名称> --service <service-id> [--path /api/v1/resource]',
  );
  console.error(
    '示例：pnpm create:integration report-center 报告中心 --service report-service --path /api/v1/reports',
  );
  process.exit(1);
}
if (!/^\/api\/v[0-9]+\/[a-z0-9/_-]+$/.test(upstreamPath)) {
  throw new Error('--path 必须是版本化的绝对 API 路径，例如 /api/v1/reports');
}
const catalog = await loadCatalog();
if (!catalog.services.some((service) => service.id === serviceId)) {
  throw new Error(`服务未注册：${serviceId}。请先执行 pnpm register:service。`);
}

const camel = slug.replace(/-([a-z0-9])/g, (_, char) => char.toUpperCase());
const pascal = camel.charAt(0).toUpperCase() + camel.slice(1);
const files = {
  portal: join(root, 'apps', 'portal', 'src', 'features', slug, 'index.tsx'),
  gateway: join(root, 'apps', 'gateway', 'src', 'routes', `${slug}.ts`),
};

for (const file of Object.values(files)) {
  try {
    await readFile(file);
    throw new Error(`集成文件已存在：${file}`);
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }
  await mkdir(dirname(file), { recursive: true });
}

await writeFile(
  files.portal,
  `import { Card } from '@applattice/ui';
import { useEffect, useState } from 'react';
import type { FeatureProps, PortalFeature } from '../types.js';

function ${pascal}Page({ client }: FeatureProps) {
  const [message, setMessage] = useState('正在加载模块…');
  useEffect(() => {
    void client
      .getModule<{ message?: string }>('${slug}')
      .then((result) => setMessage(result.message ?? '服务已接入'))
      .catch((error: Error) => setMessage(error.message));
  }, [client]);

  return (
    <div className="page-stack">
      <header className="page-heading">
        <div><span className="eyebrow">业务模块</span><h1>${title}</h1><p>由混合仓库集成脚手架生成。</p></div>
      </header>
      <Card title="服务状态"><p>{message}</p></Card>
    </div>
  );
}

export const ${camel}Feature: PortalFeature = {
  id: '${slug}',
  title: '${title}',
  description: '待补充模块说明',
  path: '/${slug}',
  navMark: '${title.slice(0, 1)}',
  requiredPermission: '${slug}:read',
  component: ${pascal}Page,
};
`,
  'utf8',
);

await writeFile(
  files.gateway,
  `import type { FastifyInstance } from 'fastify';
import type { ServiceClient } from '../clients/service-client.js';
import { GatewayError } from '../lib/errors.js';

export async function ${camel}GatewayRoutes(
  app: FastifyInstance,
  options: { serviceClient: ServiceClient },
) {
  app.get('/', async (request) => {
    if (!request.principal.permissions.includes('${slug}:read')) {
      throw new GatewayError('FORBIDDEN', '缺少权限：${slug}:read', 403);
    }
    return options.serviceClient.request('${serviceId}', '${upstreamPath}', {
      correlationId: request.correlationId,
      principal: request.principal,
    });
  });
}
`,
  'utf8',
);

async function insert(file, marker, content) {
  const source = await readFile(file, 'utf8');
  if (!source.includes(marker)) throw new Error(`注册标记缺失：${file}`);
  await writeFile(file, source.replace(marker, `${content}\n${marker}`), 'utf8');
}

await insert(
  join(root, 'packages', 'contracts', 'src', 'index.ts'),
  '  // <permission-registry>',
  `  '${slug}:read',`,
);
await insert(
  join(root, 'apps', 'gateway', 'src', 'auth', 'authenticator.ts'),
  '  // <permission-registry>',
  `  '${slug}:read',`,
);
await insert(
  join(root, 'apps', 'portal', 'src', 'features', 'registry.ts'),
  '// <module-imports>',
  `import { ${camel}Feature } from './${slug}/index.js';`,
);
await insert(
  join(root, 'apps', 'portal', 'src', 'features', 'registry.ts'),
  '  // <module-registry>',
  `  ${camel}Feature,`,
);
await insert(
  join(root, 'apps', 'gateway', 'src', 'routes', 'api.ts'),
  '// <module-imports>',
  `import { ${camel}GatewayRoutes } from './${slug}.js';`,
);
await insert(
  join(root, 'apps', 'gateway', 'src', 'routes', 'api.ts'),
  '  // <module-registry>',
  `  await app.register(${camel}GatewayRoutes, { prefix: '/${slug}', serviceClient: options.serviceClient });`,
);

console.log(`集成 ${title} (${slug}) 已创建：portal + BFF -> ${serviceId}${upstreamPath}`);
console.log('服务实现仍留在独立仓库；请补充契约生成类型、运行时校验和消费者测试。');
