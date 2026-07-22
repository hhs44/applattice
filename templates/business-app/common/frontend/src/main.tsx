import type { PlatformAppClient, PlatformAppRequest } from '@applattice/microfrontend-bridge';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import BusinessApp from './App.js';

const client: PlatformAppClient = {
  async request<T>({ path, method = 'GET', body, idempotencyKey }: PlatformAppRequest) {
    const response = await fetch(`/api/apps/__APP_ID__${path}`, {
      method,
      headers: {
        ...(body === undefined ? {} : { 'content-type': 'application/json' }),
        ...(idempotencyKey ? { 'idempotency-key': idempotencyKey } : {}),
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
    const text = await response.text();
    const payload: unknown = text ? JSON.parse(text) : undefined;
    if (!response.ok) {
      const message =
        payload && typeof payload === 'object' && 'message' in payload
          ? String((payload as { message: unknown }).message)
          : '请求失败';
      throw new Error(message);
    }
    return payload as T;
  },
};

const root = document.getElementById('root');
if (!root) throw new Error('找不到挂载节点');
document.body.classList.add('standalone-app');
createRoot(root).render(
  <StrictMode>
    <BusinessApp
      basePath="__APP_ROUTE__"
      client={client}
      navigate={(path) => window.history.pushState({}, '', path)}
      principal={{
        id: 'local-developer',
        name: '本地开发者',
        roles: ['developer'],
        permissions: ['__APP_ID__:read', '__APP_ID__:write'],
      }}
    />
  </StrictMode>,
);
