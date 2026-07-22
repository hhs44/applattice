const baseUrl = process.env.PORTAL_URL ?? 'http://127.0.0.1:8080';

async function request(path, init) {
  const response = await fetch(`${baseUrl}${path}`, init);
  const text = await response.text();
  const body = text ? JSON.parse(text) : undefined;
  if (!response.ok) {
    throw new Error(`${init?.method ?? 'GET'} ${path} -> ${response.status}: ${text}`);
  }
  return { response, body };
}

const homepage = await fetch(baseUrl);
if (!homepage.ok) throw new Error(`Portal homepage -> ${homepage.status}`);

const { body: readiness } = await request('/health/ready');
for (const serviceId of ['domain-service', 'todo-list-service']) {
  if (readiness.dependencies?.[serviceId] !== 'up') {
    throw new Error(`Gateway dependency is not ready: ${serviceId}`);
  }
}

const idempotencyKey = `todo-smoke-${Date.now()}`;
const title = `Python 模板端到端验证 ${new Date().toLocaleTimeString('zh-CN')}`;
const apiBase = '/api/apps/todo-list/todos';
const create = () =>
  request(apiBase, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'idempotency-key': idempotencyKey },
    body: JSON.stringify({ title }),
  });
const first = await create();
if (first.response.status !== 201 || first.body.title !== title) {
  throw new Error('Todo create response is invalid');
}
const replay = await create();
if (replay.body.id !== first.body.id)
  throw new Error('Todo idempotency replay returned a new item');

const updated = await request(`${apiBase}/${first.body.id}`, {
  method: 'PATCH',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify({ completed: true }),
});
if (!updated.body.completed) throw new Error('Todo update did not persist');

const listed = await request(apiBase);
if (!listed.body.items?.some((todo) => todo.id === first.body.id && todo.completed)) {
  throw new Error('Todo list does not contain the completed smoke item');
}

console.log(`Todo end-to-end smoke passed: ${first.body.id}`);
