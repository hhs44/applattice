import { DatabaseSync } from 'node:sqlite';
import { randomUUID } from 'node:crypto';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import Fastify from 'fastify';

type RecordRow = {
  id: string;
  name: string;
  completed: number;
  created_at: string;
  updated_at: string;
};
type RecordModel = {
  id: string;
  name: string;
  completed: boolean;
  createdAt: string;
  updatedAt: string;
};

function model(row: RecordRow): RecordModel {
  return {
    id: row.id,
    name: row.name,
    completed: Boolean(row.completed),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function buildApp(databasePath = process.env.DATABASE_PATH ?? '.data/records.db') {
  const app = Fastify({ logger: process.env.NODE_ENV !== 'test' });
  if (databasePath !== ':memory:') mkdirSync(dirname(databasePath), { recursive: true });
  const database = new DatabaseSync(databasePath);
  database.exec(`
    CREATE TABLE IF NOT EXISTS records (id TEXT PRIMARY KEY, name TEXT NOT NULL, completed INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL, updated_at TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS idempotency_keys (principal_id TEXT NOT NULL, idempotency_key TEXT NOT NULL, request_hash TEXT NOT NULL, record_id TEXT NOT NULL, PRIMARY KEY (principal_id, idempotency_key));
  `);
  app.addHook('onClose', async () => database.close());
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
  app.get('/health/ready', async () => {
    database.prepare('SELECT 1').get();
    return { status: 'ready', service: '__SERVICE_ID__' };
  });
  app.get('/api/v1/records', async () => {
    const rows = database
      .prepare('SELECT * FROM records ORDER BY created_at DESC')
      .all() as RecordRow[];
    return { items: rows.map(model), total: rows.length };
  });
  app.get<{ Params: { id: string } }>('/api/v1/records/:id', async (request, reply) => {
    const row = database.prepare('SELECT * FROM records WHERE id = ?').get(request.params.id) as
      RecordRow | undefined;
    return row
      ? model(row)
      : reply.code(404).send({ code: 'RECORD_NOT_FOUND', message: '记录不存在' });
  });
  app.post<{ Body: { name?: string } }>('/api/v1/records', async (request, reply) => {
    const principal = String(request.headers['x-principal-id']);
    const key = request.headers['idempotency-key'];
    const name = request.body?.name?.trim();
    if (typeof key !== 'string' || !key || !name)
      return reply
        .code(422)
        .send({ code: 'INVALID_ARGUMENT', message: 'name 和 Idempotency-Key 必填' });
    const previous = database
      .prepare(
        'SELECT request_hash, record_id FROM idempotency_keys WHERE principal_id = ? AND idempotency_key = ?',
      )
      .get(principal, key) as { request_hash: string; record_id: string } | undefined;
    if (previous) {
      if (previous.request_hash !== name)
        return reply
          .code(409)
          .send({ code: 'IDEMPOTENCY_CONFLICT', message: '幂等键已用于不同请求' });
      const row = database
        .prepare('SELECT * FROM records WHERE id = ?')
        .get(previous.record_id) as RecordRow;
      return reply.code(201).send(model(row));
    }
    const id = randomUUID();
    const timestamp = new Date().toISOString();
    database
      .prepare('INSERT INTO records VALUES (?, ?, 0, ?, ?)')
      .run(id, name, timestamp, timestamp);
    database
      .prepare('INSERT INTO idempotency_keys VALUES (?, ?, ?, ?)')
      .run(principal, key, name, id);
    return reply
      .code(201)
      .send(model(database.prepare('SELECT * FROM records WHERE id = ?').get(id) as RecordRow));
  });
  app.patch<{ Params: { id: string }; Body: { name?: string; completed?: boolean } }>(
    '/api/v1/records/:id',
    async (request, reply) => {
      const row = database.prepare('SELECT * FROM records WHERE id = ?').get(request.params.id) as
        RecordRow | undefined;
      if (!row) return reply.code(404).send({ code: 'RECORD_NOT_FOUND', message: '记录不存在' });
      database
        .prepare('UPDATE records SET name = ?, completed = ?, updated_at = ? WHERE id = ?')
        .run(
          request.body.name?.trim() || row.name,
          Number(request.body.completed ?? Boolean(row.completed)),
          new Date().toISOString(),
          row.id,
        );
      return model(database.prepare('SELECT * FROM records WHERE id = ?').get(row.id) as RecordRow);
    },
  );
  app.delete<{ Params: { id: string } }>('/api/v1/records/:id', async (request, reply) => {
    const result = database.prepare('DELETE FROM records WHERE id = ?').run(request.params.id);
    if (result.changes === 0)
      return reply.code(404).send({ code: 'RECORD_NOT_FOUND', message: '记录不存在' });
    database.prepare('DELETE FROM idempotency_keys WHERE record_id = ?').run(request.params.id);
    return reply.code(204).send();
  });
  return app;
}
