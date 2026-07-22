import type { DomainClient } from './clients/domain-client.js';
import type { ServiceClient } from './clients/service-client.js';
import { loadConfig, type GatewayConfig } from './config.js';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { buildGatewayApp } from './app.js';

const config: GatewayConfig = {
  host: '127.0.0.1',
  port: 4000,
  serviceName: 'gateway-test',
  portalOrigin: 'http://localhost:5173',
  upstreams: {
    'domain-service': {
      baseUrl: 'http://domain.invalid',
      healthPath: '/health/ready',
      requestTimeoutMs: 5000,
      required: true,
    },
  },
  apps: {},
  auth: { mode: 'dev' },
};

const applicationConfig: GatewayConfig = {
  ...config,
  upstreams: {
    ...config.upstreams,
    'todo-list-service': {
      baseUrl: 'http://todo.invalid',
      healthPath: '/health/ready',
      requestTimeoutMs: 5000,
      required: true,
    },
  },
  apps: {
    'todo-list': {
      id: 'todo-list',
      title: 'Todo 清单',
      description: '独立业务应用',
      route: '/todos',
      navMark: '待',
      requiredPermission: 'todos:read',
      frontend: {
        version: '1.0.0',
        remoteName: 'todo_list_app',
        module: './App',
        bridgeVersion: '1.0.0',
        manifestPath: '/mf-manifest.json',
        baseUrl: 'http://todo-web.invalid',
        requestTimeoutMs: 5000,
      },
      backend: { serviceId: 'todo-list-service', basePath: '/api/v1' },
      permissions: [
        { methods: ['GET'], pathPrefix: '/todos', permission: 'todos:read' },
        { methods: ['POST'], pathPrefix: '/todos', permission: 'todos:write' },
      ],
    },
  },
};

const domainClient: DomainClient = {
  async getDashboard() {
    return {
      metrics: { totalCases: 10, runningJobs: 1, passRate: 90, openDefects: 2 },
      trend: [],
      recentRuns: [],
    };
  },
  async listRuns() {
    return { items: [], total: 0 };
  },
  async createRun(input) {
    return {
      id: 'RUN-1',
      name: input.name,
      environment: input.environment,
      status: 'queued',
      progress: 0,
      createdAt: new Date().toISOString(),
    };
  },
  async isReady() {
    return true;
  },
};

const apps: Awaited<ReturnType<typeof buildGatewayApp>>[] = [];
afterEach(async () => {
  vi.unstubAllGlobals();
  await Promise.all(apps.splice(0).map((app) => app.close()));
});

describe('gateway', () => {
  it('refuses development authentication in production', () => {
    expect(() => loadConfig({ NODE_ENV: 'production', AUTH_MODE: 'dev' })).toThrow(
      '生产环境禁止使用 AUTH_MODE=dev',
    );
  });

  it('loads an arbitrary multi-repository upstream catalog', () => {
    const dynamic = loadConfig({
      AUTH_MODE: 'dev',
      UPSTREAMS_JSON: JSON.stringify({
        'report-service': {
          baseUrl: 'http://report-service:4200',
          healthPath: '/health/ready',
          requestTimeoutMs: 3000,
          required: false,
        },
      }),
    });
    expect(dynamic.upstreams['report-service']).toMatchObject({
      baseUrl: 'http://report-service:4200',
      required: false,
    });
    expect(dynamic.upstreams['domain-service']).toBeUndefined();
  });

  it('aggregates the current viewer into the dashboard', async () => {
    const app = await buildGatewayApp(config, { domainClient });
    apps.push(app);
    const response = await app.inject({ method: 'GET', url: '/api/dashboard' });
    expect(response.statusCode).toBe(200);
    expect(response.json().viewer.id).toBe('dev-engineer');
    expect(response.json().metrics.totalCases).toBe(10);
  });

  it('enforces permissions at the gateway', async () => {
    const app = await buildGatewayApp(config, { domainClient });
    apps.push(app);
    const response = await app.inject({
      method: 'GET',
      url: '/api/test-runs',
      headers: { 'x-user-permissions': 'dashboard:read' },
    });
    expect(response.statusCode).toBe(403);
    expect(response.json().code).toBe('FORBIDDEN');
  });

  it('lists and proxies registered applications with default-deny permissions', async () => {
    const created = {
      id: '0e599c09-b534-4c76-b3c7-d5aa1ca54a57',
      title: '验证混合仓库',
      completed: false,
      createdAt: '2026-07-20T12:00:00.000Z',
      updatedAt: '2026-07-20T12:00:00.000Z',
    };
    const request = vi.fn(async () => created);
    const requestRaw = vi.fn(async () => ({
      status: 201,
      body: created,
      contentType: 'application/json',
    }));
    const serviceClient: ServiceClient = {
      request,
      requestRaw,
      async isReady() {
        return true;
      },
      async readiness() {
        return { ready: true, dependencies: { 'todo-list-service': 'up' } };
      },
    };
    const app = await buildGatewayApp(applicationConfig, { domainClient, serviceClient });
    apps.push(app);
    const catalog = await app.inject({ method: 'GET', url: '/api/platform/apps' });
    expect(catalog.statusCode).toBe(200);
    expect(catalog.json().items[0]).toMatchObject({
      id: 'todo-list',
      apiBasePath: '/api/apps/todo-list',
    });
    const response = await app.inject({
      method: 'POST',
      url: '/api/apps/todo-list/todos',
      headers: { 'idempotency-key': 'todo-create-1' },
      payload: { title: '验证混合仓库' },
    });
    expect(response.statusCode).toBe(201);
    expect(response.json()).toEqual(created);
    expect(requestRaw).toHaveBeenCalledWith(
      'todo-list-service',
      '/api/v1/todos',
      expect.objectContaining({ principal: expect.objectContaining({ id: 'dev-engineer' }) }),
      expect.objectContaining({
        method: 'POST',
        headers: { 'idempotency-key': 'todo-create-1' },
      }),
    );
    const deniedRoute = await app.inject({ method: 'GET', url: '/api/apps/todo-list/admin' });
    expect(deniedRoute.statusCode).toBe(403);
    expect(deniedRoute.json().code).toBe('APP_ROUTE_DENIED');
    const hidden = await app.inject({
      method: 'GET',
      url: '/api/platform/apps',
      headers: { 'x-user-permissions': 'dashboard:read' },
    });
    expect(hidden.json().items).toEqual([]);
  });

  it('proxies module assets and isolates remote frontend failures', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(
        async () =>
          new Response('manifest', {
            status: 200,
            headers: { 'content-type': 'application/json' },
          }),
      ),
    );
    const app = await buildGatewayApp(applicationConfig, { domainClient });
    apps.push(app);
    const response = await app.inject({
      method: 'GET',
      url: '/modules/todo-list/mf-manifest.json',
    });
    expect(response.statusCode).toBe(200);
    expect(response.body).toBe('manifest');
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw new Error('offline');
      }),
    );
    const failed = await app.inject({ method: 'GET', url: '/modules/todo-list/mf-manifest.json' });
    expect(failed.statusCode).toBe(503);
    expect(failed.json().code).toBe('REMOTE_MODULE_UNAVAILABLE');
  });
});
