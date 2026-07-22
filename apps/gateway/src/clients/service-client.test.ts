import { afterEach, describe, expect, it, vi } from 'vitest';
import type { GatewayConfig } from '../config.js';
import { createServiceClient } from './service-client.js';

const config: GatewayConfig = {
  host: '127.0.0.1',
  port: 4000,
  serviceName: 'gateway-test',
  portalOrigin: 'http://localhost:5173',
  auth: { mode: 'dev' },
  apps: {},
  upstreams: {
    required: {
      baseUrl: 'http://required.invalid',
      healthPath: '/health/ready',
      requestTimeoutMs: 1000,
      required: true,
    },
    optional: {
      baseUrl: 'http://optional.invalid',
      healthPath: '/health/ready',
      requestTimeoutMs: 1000,
      required: false,
    },
  },
};

afterEach(() => vi.unstubAllGlobals());

describe('service client', () => {
  it('reports required and optional dependency readiness separately', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: string | URL | Request) =>
        String(input).includes('required.invalid')
          ? new Response('{}', { status: 503, headers: { 'content-type': 'application/json' } })
          : new Response('{}', { status: 200, headers: { 'content-type': 'application/json' } }),
      ),
    );
    const readiness = await createServiceClient(config).readiness();
    expect(readiness).toEqual({
      ready: false,
      dependencies: { required: 'down', optional: 'up' },
    });
  });

  it('rejects unregistered services before making a network call', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    await expect(
      createServiceClient(config).request('missing', '/api/v1/info'),
    ).rejects.toMatchObject({ code: 'UPSTREAM_NOT_REGISTERED' });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('rejects traversal paths and malformed JSON responses', async () => {
    const fetchMock = vi.fn(
      async () =>
        new Response('{broken', {
          status: 200,
          headers: { 'content-type': 'application/json' },
        }),
    );
    vi.stubGlobal('fetch', fetchMock);
    await expect(
      createServiceClient(config).request('required', '/api/v1/../admin'),
    ).rejects.toMatchObject({ code: 'INVALID_UPSTREAM_PATH' });
    expect(fetchMock).not.toHaveBeenCalled();

    await expect(
      createServiceClient(config).request('required', '/api/v1/info'),
    ).rejects.toMatchObject({ code: 'UPSTREAM_INVALID_RESPONSE' });
  });

  it('does not send a JSON content type for requests without a body', async () => {
    const fetchMock = vi.fn(async () => new Response(null, { status: 204 }));
    vi.stubGlobal('fetch', fetchMock);

    await createServiceClient(config).requestRaw('required', '/api/v1/records/1', undefined, {
      method: 'DELETE',
    });

    const init = fetchMock.mock.calls[0]?.[1];
    expect(new Headers(init?.headers).has('content-type')).toBe(false);
  });
});
