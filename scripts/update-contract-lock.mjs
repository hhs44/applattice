import { resolve } from 'node:path';
import {
  contractLockPath,
  loadCatalog,
  readJson,
  root,
  sha256,
  writeJson,
} from './lib/catalog.mjs';

const catalog = await loadCatalog();
const current = await readJson(contractLockPath);
const contracts = [];

for (const service of catalog.services) {
  const previous = current.contracts?.find((entry) => entry.serviceId === service.id);
  const digest = await sha256(resolve(root, service.contract.source));
  contracts.push({
    serviceId: service.id,
    name: service.contract.name,
    version: service.contract.version,
    source: service.contract.source,
    sha256: digest,
    ...(previous?.artifact ? { artifact: previous.artifact } : {}),
  });
}

await writeJson(contractLockPath, { schemaVersion: 1, contracts });
console.log(`已更新 ${contracts.length} 份契约摘要。请在提交前完成兼容性审查。`);
