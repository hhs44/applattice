import { afterEach, describe, expect, it } from 'vitest';
import { buildApp } from './app.js';

describe('__SERVICE_ID__', () => {
  const app = buildApp();
  afterEach(async () => app.close());

  it('exposes health and a protected starter endpoint', async () => {
    expect((await app.inject({ method: 'GET', url: '/health/ready' })).statusCode).toBe(200);
    expect((await app.inject({ method: 'GET', url: '/api/v1/info' })).statusCode).toBe(401);
    const info = await app.inject({
      method: 'GET',
      url: '/api/v1/info',
      headers: { 'x-principal-id': 'developer', 'x-correlation-id': 'trace-1' },
    });
    expect(info.statusCode).toBe(200);
    expect(info.headers['x-correlation-id']).toBe('trace-1');
    expect(info.json()).toEqual({ service: '__SERVICE_ID__', status: 'starter' });
  });
});
