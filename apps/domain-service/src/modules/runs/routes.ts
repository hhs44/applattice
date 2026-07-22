import { CreateTestRunRequestSchema } from '@platform/contracts';
import type { FastifyInstance } from 'fastify';
import { DomainError } from '../../lib/errors.js';
import type { RunRepository } from './repository.js';

export async function runRoutes(app: FastifyInstance, options: { repository: RunRepository }) {
  app.get('/', async () => {
    const items = await options.repository.list();
    return { items, total: items.length };
  });

  app.post('/', async (request, reply) => {
    const idempotencyKey = request.headers['idempotency-key'];
    if (typeof idempotencyKey !== 'string' || idempotencyKey.trim().length === 0) {
      throw new DomainError('IDEMPOTENCY_KEY_REQUIRED', '写操作必须提供 Idempotency-Key', 400);
    }

    const parsed = CreateTestRunRequestSchema.safeParse(request.body);
    if (!parsed.success) {
      throw new DomainError('INVALID_ARGUMENT', '测试运行参数不合法', 400, parsed.error.flatten());
    }

    const created = await options.repository.create(parsed.data, idempotencyKey);
    return reply.code(201).send(created);
  });
}
