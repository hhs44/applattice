import { resolve } from 'node:path';
import { loadCatalog, readJson, root } from './lib/catalog.mjs';

const input = process.argv[2] ?? 'deployment/releases/release-manifest.example.json';
const manifest = await readJson(resolve(root, input));
const catalog = await loadCatalog();
const digestPattern = /^[^\s]+@sha256:[a-f0-9]{64}$/;

if (manifest.schemaVersion !== 1 || !manifest.environment || !manifest.platform) {
  throw new Error('发布清单缺少 schemaVersion、environment 或 platform');
}
for (const [name, image] of Object.entries({
  portal: manifest.platform.portalImage,
  gateway: manifest.platform.gatewayImage,
})) {
  if (typeof image !== 'string' || !digestPattern.test(image)) {
    throw new Error(`${name} 镜像必须固定到 sha256 digest`);
  }
}
if (!Array.isArray(manifest.services)) throw new Error('发布清单缺少 services 数组');

for (const service of catalog.services) {
  const release = manifest.services.find((entry) => entry.id === service.id);
  if (!release) throw new Error(`发布清单缺少服务：${service.id}`);
  if (release.contractVersion !== service.contract.version) {
    throw new Error(`服务 ${service.id} 的发布契约版本与平台契约锁不一致`);
  }
  if (typeof release.image !== 'string' || !digestPattern.test(release.image)) {
    throw new Error(`服务 ${service.id} 镜像必须固定到 sha256 digest`);
  }
}
const unknown = manifest.services.filter(
  (entry) => !catalog.services.some((service) => service.id === entry.id),
);
if (unknown.length > 0) {
  throw new Error(`发布清单包含未注册服务：${unknown.map((entry) => entry.id).join(', ')}`);
}
if (!manifest.change?.ticket || !manifest.change?.rollbackManifest) {
  throw new Error('发布清单必须关联变更单和回滚清单');
}

console.log(`发布清单 ${input} 校验通过，共 ${manifest.services.length} 个业务服务。`);
