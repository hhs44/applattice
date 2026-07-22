import type { Principal } from '@platform/contracts';
import type { GatewayConfig, UpstreamConfig } from '../config.js';
import { GatewayError } from '../lib/errors.js';

export type ServiceCallContext = {
  correlationId: string;
  principal: Principal;
};

export type ServiceReadiness = Record<string, 'up' | 'down' | 'optional-down'>;

export interface ServiceClient {
  request(
    serviceId: string,
    path: string,
    context?: ServiceCallContext,
    init?: RequestInit,
  ): Promise<unknown>;
  requestRaw(
    serviceId: string,
    path: string,
    context?: ServiceCallContext,
    init?: RequestInit,
  ): Promise<ServiceResponse>;
  isReady(serviceId: string): Promise<boolean>;
  readiness(): Promise<{ ready: boolean; dependencies: ServiceReadiness }>;
}

export type ServiceResponse = {
  status: number;
  body: unknown;
  contentType: string;
};

function getUpstream(config: GatewayConfig, serviceId: string): UpstreamConfig {
  const upstream = config.upstreams[serviceId];
  if (!upstream) {
    throw new GatewayError('UPSTREAM_NOT_REGISTERED', `上游服务未注册：${serviceId}`, 502);
  }
  return upstream;
}

function validatePath(path: string) {
  let decoded = path;
  try {
    decoded = decodeURIComponent(path);
  } catch {
    throw new GatewayError('INVALID_UPSTREAM_PATH', '上游服务路径编码不合法', 500);
  }
  if (
    !path.startsWith('/') ||
    path.startsWith('//') ||
    path.includes('://') ||
    decoded.includes('\\') ||
    decoded.split('/').some((segment) => segment === '.' || segment === '..')
  ) {
    throw new GatewayError('INVALID_UPSTREAM_PATH', '上游服务路径不合法', 500);
  }
}

export function createServiceClient(config: GatewayConfig): ServiceClient {
  async function isReady(serviceId: string): Promise<boolean> {
    const upstream = getUpstream(config, serviceId);
    try {
      const response = await fetch(`${upstream.baseUrl}${upstream.healthPath}`, {
        signal: AbortSignal.timeout(Math.min(upstream.requestTimeoutMs, 2000)),
      });
      return response.ok;
    } catch {
      return false;
    }
  }

  async function requestRaw(
    serviceId: string,
    path: string,
    context?: ServiceCallContext,
    init?: RequestInit,
  ): Promise<ServiceResponse> {
    validatePath(path);
    const upstream = getUpstream(config, serviceId);
    let response: Response;
    try {
      const hasJsonBody = init?.body !== undefined && init.body !== null;
      response = await fetch(`${upstream.baseUrl}${path}`, {
        ...init,
        signal: AbortSignal.timeout(upstream.requestTimeoutMs),
        headers: {
          ...(hasJsonBody ? { 'content-type': 'application/json' } : {}),
          ...(context
            ? {
                'x-correlation-id': context.correlationId,
                'x-principal-id': context.principal.id,
              }
            : {}),
          ...init?.headers,
        },
      });
    } catch {
      throw new GatewayError('UPSTREAM_UNAVAILABLE', `上游服务暂时不可用：${serviceId}`, 503);
    }

    const contentType = response.headers.get('content-type') ?? '';
    const rawBody = await response.text();
    let body: unknown;
    try {
      body =
        contentType.includes('application/json') && rawBody
          ? (JSON.parse(rawBody) as unknown)
          : rawBody
            ? rawBody
            : undefined;
    } catch {
      throw new GatewayError(
        'UPSTREAM_INVALID_RESPONSE',
        `上游服务返回了无效 JSON：${serviceId}`,
        502,
      );
    }
    if (!response.ok) {
      const errorBody =
        body && typeof body === 'object' ? (body as { message?: string; details?: unknown }) : {};
      throw new GatewayError(
        'UPSTREAM_REJECTED',
        errorBody.message ?? (typeof body === 'string' ? body : `上游服务请求失败：${serviceId}`),
        response.status >= 500 ? 502 : response.status,
        errorBody.details,
      );
    }
    return { status: response.status, body, contentType };
  }

  return {
    async request(serviceId, path, context, init) {
      return (await requestRaw(serviceId, path, context, init)).body;
    },
    requestRaw,
    isReady,
    async readiness() {
      const entries = await Promise.all(
        Object.entries(config.upstreams).map(async ([id, upstream]) => {
          const up = await isReady(id);
          return [id, up ? 'up' : upstream.required ? 'down' : 'optional-down'] as const;
        }),
      );
      const dependencies = Object.fromEntries(entries) as ServiceReadiness;
      return {
        ready: Object.entries(config.upstreams).every(
          ([id, upstream]) => !upstream.required || dependencies[id] === 'up',
        ),
        dependencies,
      };
    },
  };
}
