import { randomUUID } from 'node:crypto';
import type { FastifyInstance } from 'fastify';

export async function registerRequestContext(app: FastifyInstance) {
  app.addHook('onRequest', async (request, reply) => {
    const incoming = request.headers['x-correlation-id'];
    const correlationId =
      typeof incoming === 'string' && incoming.length > 0 ? incoming : randomUUID();
    request.correlationId = correlationId;
    reply.header('x-correlation-id', correlationId);
  });
}

declare module 'fastify' {
  interface FastifyRequest {
    correlationId: string;
  }
}
