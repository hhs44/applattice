import assert from 'node:assert/strict';
import test from 'node:test';
import { scaffoldApp, scaffoldPortal } from './cli.mjs';

test('portal dry-run validates a supported layout', async () => {
  const result = await scaffoldPortal([
    'sample-platform',
    '--title',
    '示例平台',
    '--layout',
    'modern-topnav',
    '--dry-run',
    '--output',
    '.tmp/scaffold-portal',
  ]);
  assert.equal(result.layout, 'modern-topnav');
});

test('app dry-run resolves Python and rejects colliding ports', async () => {
  const result = await scaffoldApp([
    'sample-app',
    '示例应用',
    '--backend',
    'python',
    '--dry-run',
    '--output',
    '.tmp/scaffold-app',
  ]);
  assert.equal(result.backend, 'python');
  await assert.rejects(
    scaffoldApp([
      'bad-app',
      '错误应用',
      '--backend',
      'node',
      '--web-port',
      '4300',
      '--api-port',
      '4300',
      '--dry-run',
    ]),
    /不能相同/,
  );
  await assert.rejects(
    scaffoldApp([
      'bad-empty-app',
      '错误空应用',
      '--backend',
      'node',
      '--example',
      'none',
      '--database',
      'sqlite',
      '--dry-run',
    ]),
    /database none/,
  );
  const empty = await scaffoldApp([
    'empty-app',
    '空应用',
    '--backend',
    'python',
    '--example',
    'none',
    '--database',
    'none',
    '--dry-run',
  ]);
  assert.equal(empty.backend, 'python');
});
