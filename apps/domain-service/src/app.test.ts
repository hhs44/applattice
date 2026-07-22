import { afterEach, describe, expect, it } from 'vitest';
import { buildDomainApp } from './app.js';

const apps: Awaited<ReturnType<typeof buildDomainApp>>[] = [];

afterEach(async () => {
  await Promise.all(apps.splice(0).map((app) => app.close()));
});

describe('domain service', () => {
  it('returns dashboard data with a correlation id', async () => {
    const app = await buildDomainApp();
    apps.push(app);
    const response = await app.inject({ method: 'GET', url: '/api/v1/dashboard' });
    expect(response.statusCode).toBe(200);
    expect(response.headers['x-correlation-id']).toBeTruthy();
    expect(response.json().metrics.passRate).toBe(96.8);
  });

  it('requires an idempotency key for writes', async () => {
    const app = await buildDomainApp();
    apps.push(app);
    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/test-runs',
      payload: { name: '新回归任务', environment: 'SIL' },
    });
    expect(response.statusCode).toBe(400);
    expect(response.json().code).toBe('IDEMPOTENCY_KEY_REQUIRED');
  });

  it('replays an idempotent write without creating a duplicate', async () => {
    const app = await buildDomainApp();
    apps.push(app);
    const request = {
      method: 'POST' as const,
      url: '/api/v1/test-runs',
      headers: { 'idempotency-key': 'same-operation' },
      payload: { name: '幂等回归任务', environment: 'SIL' },
    };
    const first = await app.inject(request);
    const replay = await app.inject(request);
    const list = await app.inject({ method: 'GET', url: '/api/v1/test-runs' });

    expect(first.json().id).toBe(replay.json().id);
    expect(
      list.json().items.filter((run: { name: string }) => run.name === '幂等回归任务'),
    ).toHaveLength(1);
  });
});
