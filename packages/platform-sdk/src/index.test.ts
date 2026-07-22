import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Principal } from '@applattice/contracts';
import { createPlatformClient, hasPermission } from './index.js';

const principal: Principal = {
  id: 'tester-1',
  name: '测试工程师',
  roles: ['tester'],
  permissions: ['dashboard:read', 'runs:read'],
};

afterEach(() => vi.unstubAllGlobals());

describe('hasPermission', () => {
  it('allows declared permissions and public features', () => {
    expect(hasPermission(principal, 'runs:read')).toBe(true);
    expect(hasPermission(principal)).toBe(true);
  });

  it('rejects missing permissions', () => {
    expect(hasPermission(principal, 'admin:access')).toBe(false);
  });

  it('uses the generic application gateway and accepts an empty delete response', async () => {
    const fetchMock = vi.fn(async (_input: string | URL | Request, init?: RequestInit) =>
      init?.method === 'DELETE'
        ? new Response(null, { status: 204 })
        : new Response(JSON.stringify({ items: [{ id: 'record-1' }], total: 1 }), {
            status: 200,
            headers: { 'content-type': 'application/json' },
          }),
    );
    vi.stubGlobal('fetch', fetchMock);
    const client = createPlatformClient();
    expect(
      (await client.forApp('records').request<{ items: { id: string }[] }>({ path: '/records' }))
        .items[0]?.id,
    ).toBe('record-1');
    await expect(
      client.forApp('records').request({ path: '/records/record-1', method: 'DELETE' }),
    ).resolves.toBeUndefined();
    expect(fetchMock).toHaveBeenCalledWith('/api/apps/records/records', expect.any(Object));
    const deleteInit = fetchMock.mock.calls[1]?.[1];
    expect(new Headers(deleteInit?.headers).has('content-type')).toBe(false);
  });
});
