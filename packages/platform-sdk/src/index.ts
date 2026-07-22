import {
  CreateTestRunRequestSchema,
  PortalDashboardSchema,
  PortalAppListSchema,
  PrincipalSchema,
  TestRunListSchema,
  TestRunSchema,
  type CreateTestRunRequest,
  type Permission,
  type Principal,
} from '@applattice/contracts';

export class PlatformApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly correlationId?: string,
  ) {
    super(message);
    this.name = 'PlatformApiError';
  }
}

async function requestJson(url: string, init?: RequestInit): Promise<unknown> {
  const hasJsonBody = init?.body !== undefined && init.body !== null;
  const response = await fetch(url, {
    ...init,
    headers: {
      ...(hasJsonBody ? { 'content-type': 'application/json' } : {}),
      ...init?.headers,
    },
  });

  const correlationId = response.headers.get('x-correlation-id') ?? undefined;
  const text = await response.text();
  let body: { message?: string } | undefined;
  try {
    body = text ? (JSON.parse(text) as { message?: string }) : undefined;
  } catch {
    throw new PlatformApiError('平台返回了无法解析的响应', 502, correlationId);
  }
  if (!response.ok) {
    throw new PlatformApiError(body?.message ?? '平台请求失败', response.status, correlationId);
  }
  return body;
}

export function createPlatformClient(baseUrl = '') {
  return {
    async getSession() {
      return PrincipalSchema.parse(await requestJson(`${baseUrl}/api/session`));
    },
    async getDashboard() {
      return PortalDashboardSchema.parse(await requestJson(`${baseUrl}/api/dashboard`));
    },
    async listApps() {
      return PortalAppListSchema.parse(await requestJson(`${baseUrl}/api/platform/apps`));
    },
    forApp(appId: string) {
      if (!/^[a-z][a-z0-9-]*$/.test(appId)) throw new Error('应用标识不合法');
      return {
        async request<T>({
          path,
          method = 'GET',
          body,
          idempotencyKey,
        }: {
          path: string;
          method?: string;
          body?: unknown;
          idempotencyKey?: string;
        }): Promise<T> {
          if (!path.startsWith('/') || path.startsWith('//') || path.includes('..')) {
            throw new Error('应用请求路径不合法');
          }
          return (await requestJson(`${baseUrl}/api/apps/${appId}${path}`, {
            method,
            headers: {
              ...(idempotencyKey ? { 'idempotency-key': idempotencyKey } : {}),
            },
            ...(body === undefined ? {} : { body: JSON.stringify(body) }),
          })) as T;
        },
      };
    },
    async listRuns() {
      return TestRunListSchema.parse(await requestJson(`${baseUrl}/api/test-runs`));
    },
    async createRun(input: CreateTestRunRequest) {
      const payload = CreateTestRunRequestSchema.parse(input);
      return TestRunSchema.parse(
        await requestJson(`${baseUrl}/api/test-runs`, {
          method: 'POST',
          headers: { 'idempotency-key': crypto.randomUUID() },
          body: JSON.stringify(payload),
        }),
      );
    },
    async getModule<T = unknown>(moduleId: string): Promise<T> {
      if (!/^[a-z0-9-]+$/.test(moduleId)) throw new Error('模块标识不合法');
      return (await requestJson(`${baseUrl}/api/${moduleId}`)) as T;
    },
  };
}

export type PlatformClient = ReturnType<typeof createPlatformClient>;

export function hasPermission(principal: Principal, permission?: Permission): boolean {
  return permission === undefined || principal.permissions.includes(permission);
}
