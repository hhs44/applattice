export type GatewayConfig = {
  host: string;
  port: number;
  serviceName: string;
  portalOrigin: string;
  upstreams: Record<string, UpstreamConfig>;
  apps: Record<string, AppRuntimeConfig>;
  auth:
    | { mode: 'dev' }
    | {
        mode: 'oidc';
        issuer: string;
        audience: string;
        jwksUrl: string;
      };
};

export type AppPermissionRule = {
  methods: string[];
  pathPrefix: string;
  permission: string;
};

export type AppRuntimeConfig = {
  id: string;
  title: string;
  description: string;
  route: string;
  navMark: string;
  requiredPermission: string;
  frontend: {
    version: string;
    remoteName: string;
    module: './App';
    bridgeVersion: string;
    manifestPath: string;
    baseUrl: string;
    requestTimeoutMs: number;
  };
  backend: {
    serviceId: string;
    basePath: string;
  };
  permissions: AppPermissionRule[];
};

export type UpstreamConfig = {
  baseUrl: string;
  healthPath: string;
  requestTimeoutMs: number;
  required: boolean;
};

function required(env: NodeJS.ProcessEnv, key: string): string {
  const value = env[key];
  if (!value) throw new Error(`环境变量 ${key} 未配置`);
  return value;
}

function parseUpstreams(env: NodeJS.ProcessEnv): Record<string, UpstreamConfig> {
  const fallback: Record<string, UpstreamConfig> = {
    'domain-service': {
      baseUrl: env.DOMAIN_SERVICE_URL ?? 'http://localhost:4100',
      healthPath: '/health/ready',
      requestTimeoutMs: 5000,
      required: true,
    },
  };

  if (!env.UPSTREAMS_JSON) return fallback;

  let input: unknown;
  try {
    input = JSON.parse(env.UPSTREAMS_JSON);
  } catch {
    throw new Error('UPSTREAMS_JSON 必须是合法 JSON');
  }
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    throw new Error('UPSTREAMS_JSON 必须是以服务 ID 为键的对象');
  }

  const upstreams: Record<string, UpstreamConfig> = {};
  for (const [id, value] of Object.entries(input)) {
    if (!/^[a-z][a-z0-9-]*$/.test(id) || !value || typeof value !== 'object') {
      throw new Error(`上游服务配置不合法：${id}`);
    }
    const candidate = value as Partial<UpstreamConfig>;
    if (
      typeof candidate.baseUrl !== 'string' ||
      !/^https?:\/\//.test(candidate.baseUrl) ||
      typeof candidate.healthPath !== 'string' ||
      !candidate.healthPath.startsWith('/') ||
      !Number.isInteger(candidate.requestTimeoutMs) ||
      Number(candidate.requestTimeoutMs) < 100 ||
      typeof candidate.required !== 'boolean'
    ) {
      throw new Error(`上游服务配置字段不完整：${id}`);
    }
    upstreams[id] = candidate as UpstreamConfig;
  }
  return upstreams;
}

function parseApps(env: NodeJS.ProcessEnv): Record<string, AppRuntimeConfig> {
  if (!env.APP_CATALOG_JSON) return {};
  let input: unknown;
  try {
    input = JSON.parse(env.APP_CATALOG_JSON);
  } catch {
    throw new Error('APP_CATALOG_JSON 必须是合法 JSON');
  }
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    throw new Error('APP_CATALOG_JSON 必须是以应用 ID 为键的对象');
  }
  const apps: Record<string, AppRuntimeConfig> = {};
  for (const [id, value] of Object.entries(input)) {
    const app = value as Partial<AppRuntimeConfig>;
    if (
      !/^[a-z][a-z0-9-]*$/.test(id) ||
      app.id !== id ||
      typeof app.title !== 'string' ||
      typeof app.route !== 'string' ||
      typeof app.requiredPermission !== 'string' ||
      !app.frontend ||
      !/^https?:\/\//.test(app.frontend.baseUrl ?? '') ||
      !app.backend ||
      !Array.isArray(app.permissions)
    ) {
      throw new Error(`应用运行配置不合法：${id}`);
    }
    apps[id] = app as AppRuntimeConfig;
  }
  return apps;
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): GatewayConfig {
  const authMode = env.AUTH_MODE ?? 'dev';
  if (authMode !== 'dev' && authMode !== 'oidc') {
    throw new Error('AUTH_MODE 仅支持 dev 或 oidc');
  }
  if (env.NODE_ENV === 'production' && authMode === 'dev') {
    throw new Error('生产环境禁止使用 AUTH_MODE=dev，请配置企业 OIDC');
  }

  const auth =
    authMode === 'oidc'
      ? {
          mode: 'oidc' as const,
          issuer: required(env, 'OIDC_ISSUER'),
          audience: required(env, 'OIDC_AUDIENCE'),
          jwksUrl: required(env, 'OIDC_JWKS_URL'),
        }
      : { mode: 'dev' as const };

  return {
    host: env.HOST ?? '0.0.0.0',
    port: Number(env.GATEWAY_PORT ?? 4000),
    serviceName: env.SERVICE_NAME ?? 'gateway',
    portalOrigin: env.PORTAL_ORIGIN ?? 'http://localhost:5173',
    upstreams: parseUpstreams(env),
    apps: parseApps(env),
    auth,
  };
}
