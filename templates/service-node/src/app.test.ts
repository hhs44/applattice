import { afterEach, describe, expect, it } from 'vitest';
import { buildApp } from './app.js';

const apps: ReturnType<typeof buildApp>[] = [];
afterEach(async () => Promise.all(apps.splice(0).map((app) => app.close())));

describe('__SERVICE_ID__', () => {
  it('supports CRUD, identity and idempotency', async () => {
    const app = buildApp(':memory:');
    apps.push(app);
    expect((await app.inject('/health/ready')).statusCode).toBe(200);
    expect((await app.inject('/api/v1/records')).statusCode).toBe(401);
    const headers = { 'x-principal-id': 'developer', 'idempotency-key': 'create-1' };
    const created = await app.inject({
      method: 'POST',
      url: '/api/v1/records',
      headers,
      payload: { name: '第一条记录' },
    });
    expect(created.statusCode).toBe(201);
    const record = created.json();
    expect(
      (
        await app.inject({
          method: 'POST',
          url: '/api/v1/records',
          headers,
          payload: { name: '第一条记录' },
        })
      ).json().id,
    ).toBe(record.id);
    expect((await app.inject({ url: '/api/v1/records', headers })).json().total).toBe(1);
    expect(
      (
        await app.inject({
          method: 'PATCH',
          url: `/api/v1/records/${record.id}`,
          headers,
          payload: { completed: true },
        })
      ).json().completed,
    ).toBe(true);
    expect(
      (await app.inject({ method: 'DELETE', url: `/api/v1/records/${record.id}`, headers }))
        .statusCode,
    ).toBe(204);
  });
});
