const baseUrl = (process.env.PLATFORM_URL ?? 'http://localhost:8080').replace(/\/$/, '');

async function request(path, init) {
  const response = await fetch(`${baseUrl}${path}`, init);
  const text = await response.text();
  let body;
  try {
    body = JSON.parse(text);
  } catch {
    body = text;
  }
  if (!response.ok) {
    throw new Error(`${init?.method ?? 'GET'} ${path} -> ${response.status}: ${text}`);
  }
  return { response, body };
}

const homepage = await request('/');
if (!String(homepage.body).includes('AppLattice')) throw new Error('门户首页内容不正确');

await request('/health/live');
await request('/health/ready');

const session = await request('/api/session');
if (!session.body.id) throw new Error('会话接口缺少用户标识');

const dashboard = await request('/api/dashboard');
if (typeof dashboard.body.metrics?.passRate !== 'number') throw new Error('工作台指标缺失');

const created = await request('/api/test-runs', {
  method: 'POST',
  headers: {
    'content-type': 'application/json',
    'idempotency-key': `smoke-${Date.now()}`,
  },
  body: JSON.stringify({ name: '部署后冒烟验证', environment: 'SIL 集群' }),
});
if (created.body.status !== 'queued') throw new Error('新建运行状态不正确');

const runs = await request('/api/test-runs');
if (!runs.body.items?.some((run) => run.id === created.body.id))
  throw new Error('新建运行未出现在列表中');

console.log(`冒烟验证通过：${baseUrl}`);
