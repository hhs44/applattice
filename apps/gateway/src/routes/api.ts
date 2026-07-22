import { CreateTestRunRequestSchema, type Permission } from '@applattice/contracts';
import type { FastifyInstance, FastifyRequest } from 'fastify';
import type { Authenticator } from '../auth/authenticator.js';
import type { DomainClient } from '../clients/domain-client.js';
import type { ServiceClient } from '../clients/service-client.js';
import type { AppRuntimeConfig } from '../config.js';
import { GatewayError } from '../lib/errors.js';
import { appGatewayRoutes } from './apps.js';
// <module-imports>

function requirePermission(request: FastifyRequest, permission: Permission) {
  if (!request.principal.permissions.includes(permission)) {
    throw new GatewayError('FORBIDDEN', `缺少权限：${permission}`, 403);
  }
}

export async function apiRoutes(
  app: FastifyInstance,
  options: {
    authenticate: Authenticator;
    domainClient: DomainClient;
    serviceClient: ServiceClient;
    apps: Record<string, AppRuntimeConfig>;
  },
) {
  app.addHook('preHandler', async (request) => {
    request.principal = await options.authenticate(request);
  });

  app.get('/session', async (request) => request.principal);

  await app.register(appGatewayRoutes, {
    apps: options.apps,
    serviceClient: options.serviceClient,
  });

  app.get('/dashboard', async (request) => {
    requirePermission(request, 'dashboard:read');
    const dashboard = await options.domainClient.getDashboard({
      correlationId: request.correlationId,
      principal: request.principal,
    });
    return {
      ...dashboard,
      viewer: request.principal,
      generatedAt: new Date().toISOString(),
    };
  });

  app.get('/test-runs', async (request) => {
    requirePermission(request, 'runs:read');
    return options.domainClient.listRuns({
      correlationId: request.correlationId,
      principal: request.principal,
    });
  });

  app.post('/test-runs', async (request, reply) => {
    requirePermission(request, 'runs:create');
    const idempotencyKey = request.headers['idempotency-key'];
    if (typeof idempotencyKey !== 'string' || idempotencyKey.length === 0) {
      throw new GatewayError('IDEMPOTENCY_KEY_REQUIRED', '写操作必须提供 Idempotency-Key', 400);
    }
    const parsed = CreateTestRunRequestSchema.safeParse(request.body);
    if (!parsed.success) {
      throw new GatewayError('INVALID_ARGUMENT', '测试运行参数不合法', 400, parsed.error.flatten());
    }
    const created = await options.domainClient.createRun(parsed.data, idempotencyKey, {
      correlationId: request.correlationId,
      principal: request.principal,
    });
    return reply.code(201).send(created);
  });

  // <module-registry>
}
