import Fastify from 'fastify';
import { loadConfig, type DomainConfig } from './config.js';
import { DomainError } from './lib/errors.js';
import { registerRequestContext } from './lib/request-context.js';
import { registerDomainModules } from './modules/index.js';

export async function buildDomainApp(config: DomainConfig = loadConfig()) {
  const app = Fastify({
    logger: process.env.NODE_ENV !== 'test',
  });

  await registerRequestContext(app);

  app.get('/health/live', async () => ({ status: 'ok', service: config.serviceName }));
  app.get('/health/ready', async () => ({ status: 'ready', service: config.serviceName }));

  await app.register(registerDomainModules, { prefix: '/api/v1' });

  app.setErrorHandler((error, request, reply) => {
    const knownError = error instanceof DomainError;
    const statusCode = knownError ? error.statusCode : 500;
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    request.log.error({ err: error, correlationId: request.correlationId }, errorMessage);
    void reply.code(statusCode).send({
      code: knownError ? error.code : 'INTERNAL_ERROR',
      message: knownError ? error.message : '领域服务内部错误',
      correlationId: request.correlationId,
      ...(knownError && error.details !== undefined ? { details: error.details } : {}),
    });
  });

  return app;
}
