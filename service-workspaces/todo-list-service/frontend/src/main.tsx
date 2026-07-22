import type { PlatformAppClient, PlatformAppRequest } from '@platform/microfrontend-bridge';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import TodoApp from './App.js';

const client: PlatformAppClient = {
  async request<T>(options: PlatformAppRequest): Promise<T> {
    const { path, method = 'GET', body, idempotencyKey } = options;
    const response = await fetch(`/api/apps/todo-list${path}`, {
      method,
      headers: {
        ...(body === undefined ? {} : { 'content-type': 'application/json' }),
        ...(idempotencyKey ? { 'idempotency-key': idempotencyKey } : {}),
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
    const text = await response.text();
    const payload: unknown = text ? JSON.parse(text) : undefined;
    const message =
      payload && typeof payload === 'object' && 'message' in payload
        ? String((payload as { message: unknown }).message)
        : '请求失败';
    if (!response.ok) throw new Error(message);
    return payload as T;
  },
};

const root = document.getElementById('root');
if (!root) throw new Error('找不到挂载节点');
document.body.classList.add('standalone-app');
createRoot(root).render(
  <StrictMode>
    <TodoApp
      basePath="/todos"
      client={client}
      navigate={(path) => window.history.pushState({}, '', path)}
      principal={{ id: 'dev-engineer', name: '独立前端开发者', roles: ['tester'], permissions: ['todos:read', 'todos:write'] }}
    />
  </StrictMode>,
);
