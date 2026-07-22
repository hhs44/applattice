import { randomUUID } from 'node:crypto';
import Fastify from 'fastify';

export function buildApp() {
  const app = Fastify({ logger: process.env.NODE_ENV !== 'test' });

  app.addHook('onRequest', async (request, reply) => {
    const correlationId =
      typeof request.headers['x-correlation-id'] === 'string'
        ? request.headers['x-correlation-id']
        : randomUUID();
    reply.header('x-correlation-id', correlationId);
    if (request.url.startsWith('/api/v1/') && !request.headers['x-principal-id']) {
      return reply
        .code(401)
        .send({ code: 'UNAUTHORIZED', message: '缺少内部主体标识', correlationId });
    }
  });

  app.get('/health/live', async () => ({ status: 'ok', service: '__SERVICE_ID__' }));
  app.get('/health/ready', async () => ({ status: 'ready', service: '__SERVICE_ID__' }));
  app.get('/api/v1/info', async () => ({ service: '__SERVICE_ID__', status: 'starter' }));

  return app;
}
