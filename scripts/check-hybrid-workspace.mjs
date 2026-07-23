import {
  exists,
  loadCatalog,
  loadWorkspace,
  readJson,
  serviceManifestPath,
  serviceManifestRequired,
  serviceSource,
} from './lib/catalog.mjs';

const strict = process.argv.includes('--strict');
const catalog = await loadCatalog();
const workspace = await loadWorkspace();
const rows = [];
let hasError = false;

for (const service of catalog.services) {
  const source = serviceSource(service, workspace);
  const sourceExists = await exists(source.path);
  let manifest = 'not-found';
  const manifestPath = await serviceManifestPath(source.path);
  if (await exists(manifestPath)) {
    const value = await readJson(manifestPath);
    if (value.id !== service.id) {
      manifest = `id-mismatch:${value.id}`;
      hasError = true;
    } else if (value.contract?.version !== service.contract.version) {
      manifest = `contract-mismatch:${value.contract?.version ?? 'missing'}`;
      hasError = true;
    } else {
      manifest = 'ok';
    }
  } else if (serviceManifestRequired(service, source, strict)) {
    hasError = true;
  }
  if (!sourceExists && (strict || source.overridden)) hasError = true;
  rows.push({
    service: service.id,
    runtime: service.runtime,
    source: source.path,
    sourceExists,
    override: source.overridden,
    manifest,
  });
}

console.table(rows);
if (hasError) {
  throw new Error(
    '混合工作区检查失败。兼容样例可不包含 manifest；显式配置的独立仓库必须提供匹配的 service.manifest.json。',
  );
}
console.log('混合工作区检查通过。');
