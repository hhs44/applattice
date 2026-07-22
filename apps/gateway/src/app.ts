import cors from '@fastify/cors';
import Fastify from 'fastify';
import { createAuthenticator, type Authenticator } from './auth/authenticator.js';
import { createDomainClient, type DomainClient } from './clients/domain-client.js';
import { createServiceClient, type ServiceClient } from './clients/service-client.js';
import { loadConfig, type GatewayConfig } from './config.js';
import { GatewayError } from './lib/errors.js';
import { registerRequestContext } from './lib/request-context.js';
import { apiRoutes } from './routes/api.js';
import { moduleAssetRoutes } from './routes/module-assets.js';

type GatewayDependencies = {
  authenticate?: Authenticator;
  domainClient?: DomainClient;
  serviceClient?: ServiceClient;
};

export async function buildGatewayApp(
  config: GatewayConfig = loadConfig(),
  dependencies: GatewayDependencies = {},
) {
  const app = Fastify({
    logger: process.env.NODE_ENV !== 'test',
  });
  const serviceClient = dependencies.serviceClient ?? createServiceClient(config);
  const domainClient = dependencies.domainClient ?? createDomainClient(serviceClient);
  const authenticate = dependencies.authenticate ?? createAuthenticator(config);

  await app.register(cors, {
    origin: config.portalOrigin.split(',').map((origin) => origin.trim()),
    credentials: true,
  });
  await registerRequestContext(app);
  await app.register(moduleAssetRoutes, { apps: config.apps });

  app.get('/health/live', async () => ({ status: 'ok', service: config.serviceName }));
  app.get('/health/ready', async (_request, reply) => {
    const readiness = await serviceClient.readiness();
    return reply.code(readiness.ready ? 200 : 503).send({
      status: readiness.ready ? 'ready' : 'not-ready',
      service: config.serviceName,
      dependencies: readiness.dependencies,
    });
  });

  await app.register(apiRoutes, {
    prefix: '/api',
    authenticate,
    domainClient,
    serviceClient,
    apps: config.apps,
  });

  app.setErrorHandler((error, request, reply) => {
    const knownError = error instanceof GatewayError;
    const statusCode = knownError ? error.statusCode : 500;
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    request.log.error({ err: error, correlationId: request.correlationId }, errorMessage);
    void reply.code(statusCode).send({
      code: knownError ? error.code : 'INTERNAL_ERROR',
      message: knownError ? error.message : '网关内部错误',
      correlationId: request.correlationId,
      ...(knownError && error.details !== undefined ? { details: error.details } : {}),
    });
  });

  return app;
}
