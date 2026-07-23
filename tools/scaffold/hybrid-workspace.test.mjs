import assert from 'node:assert/strict';
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import test from 'node:test';
import { serviceManifestPath, serviceManifestRequired } from '../../scripts/lib/catalog.mjs';

test('resolves the backend manifest declared by a full-stack app', async () => {
  const directory = await mkdtemp(resolve(tmpdir(), 'applattice-hybrid-'));
  try {
    await mkdir(resolve(directory, 'backend'));
    await writeFile(
      resolve(directory, 'platform-app.manifest.json'),
      JSON.stringify({ backend: { manifest: 'backend/service.manifest.json' } }),
    );
    await writeFile(resolve(directory, 'backend/service.manifest.json'), '{}');

    assert.equal(
      await serviceManifestPath(directory),
      resolve(directory, 'backend/service.manifest.json'),
    );
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test('strict mode keeps the compatibility sample exception', () => {
  const compatibilityService = { development: { fallbackPath: '.' } };
  const independentService = {
    development: { fallbackPath: 'service-workspaces/report-service' },
  };

  assert.equal(serviceManifestRequired(compatibilityService, { overridden: false }, true), false);
  assert.equal(serviceManifestRequired(independentService, { overridden: false }, true), true);
  assert.equal(serviceManifestRequired(compatibilityService, { overridden: true }, false), true);
});
