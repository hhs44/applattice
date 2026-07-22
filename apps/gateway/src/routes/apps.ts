import type { FastifyInstance, FastifyRequest } from 'fastify';
import type { AppRuntimeConfig } from '../config.js';
import type { ServiceClient } from '../clients/service-client.js';
import { GatewayError } from '../lib/errors.js';

function requirePermission(request: FastifyRequest, permission: string) {
  if (!request.principal.permissions.includes(permission)) {
    throw new GatewayError('FORBIDDEN', `缺少权限：${permission}`, 403);
  }
}

function safeRelativePath(value: string): string {
  let decoded = value;
  try {
    decoded = decodeURIComponent(value);
  } catch {
    throw new GatewayError('INVALID_APP_PATH', '应用路径编码不合法', 400);
  }
  const path = `/${value}`.replace(/\/+$/, '') || '/';
  if (decoded.includes('\\') || decoded.split('/').some((part) => part === '.' || part === '..')) {
    throw new GatewayError('INVALID_APP_PATH', '应用路径不合法', 400);
  }
  return path;
}

function querySuffix(rawUrl: string): string {
  const index = rawUrl.indexOf('?');
  return index >= 0 ? rawUrl.slice(index) : '';
}

export async function appGatewayRoutes(
  app: FastifyInstance,
  options: { apps: Record<string, AppRuntimeConfig>; serviceClient: ServiceClient },
) {
  app.get('/platform/apps', async (request) => ({
    items: Object.values(options.apps)
      .filter((entry) => request.principal.permissions.includes(entry.requiredPermission))
      .map((entry) => ({
        id: entry.id,
        title: entry.title,
        description: entry.description,
        route: entry.route,
        navMark: entry.navMark,
        requiredPermission: entry.requiredPermission,
        frontend: {
          version: entry.frontend.version,
          remoteName: entry.frontend.remoteName,
          module: entry.frontend.module,
          bridgeVersion: entry.frontend.bridgeVersion,
          manifestUrl: `/modules/${entry.id}${entry.frontend.manifestPath}`,
        },
        apiBasePath: `/api/apps/${entry.id}`,
      })),
  }));

  app.route({
    method: ['GET', 'HEAD', 'POST', 'PATCH', 'PUT', 'DELETE'],
    url: '/apps/:appId/*',
    async handler(request, reply) {
      const params = request.params as { appId: string; '*': string };
      const runtimeApp = options.apps[params.appId];
      if (!runtimeApp) {
        throw new GatewayError('APP_NOT_REGISTERED', `应用未注册：${params.appId}`, 404);
      }
      const relativePath = safeRelativePath(params['*']);
      const rule = runtimeApp.permissions.find(
        (candidate) =>
          candidate.methods.includes(request.method) &&
          (relativePath === candidate.pathPrefix ||
            relativePath.startsWith(`${candidate.pathPrefix}/`)),
      );
      if (!rule) {
        throw new GatewayError('APP_ROUTE_DENIED', '应用接口没有匹配的授权规则', 403);
      }
      requirePermission(request, rule.permission);
      const idempotencyKey = request.headers['idempotency-key'];
      const body = request.body === undefined ? undefined : JSON.stringify(request.body);
      const result = await options.serviceClient.requestRaw(
        runtimeApp.backend.serviceId,
        `${runtimeApp.backend.basePath}${relativePath}${querySuffix(request.raw.url ?? '')}`,
        { correlationId: request.correlationId, principal: request.principal },
        {
          method: request.method,
          ...(body === undefined ? {} : { body }),
          headers: {
            ...(typeof idempotencyKey === 'string' ? { 'idempotency-key': idempotencyKey } : {}),
          },
        },
      );
      if (result.contentType) reply.header('content-type', result.contentType);
      return reply.code(result.status).send(result.body);
    },
  });
}
