import type { FastifyInstance } from 'fastify';
import type { AppRuntimeConfig } from '../config.js';
import { GatewayError } from '../lib/errors.js';

function safeAssetPath(appId: string, wildcard: string): string {
  let decoded = wildcard;
  try {
    decoded = decodeURIComponent(wildcard);
  } catch {
    throw new GatewayError('INVALID_MODULE_PATH', '远程模块路径编码不合法', 400);
  }
  if (decoded.includes('\\') || decoded.split('/').some((part) => part === '.' || part === '..')) {
    throw new GatewayError('INVALID_MODULE_PATH', '远程模块路径不合法', 400);
  }
  return `/modules/${appId}/${wildcard}`;
}

export async function moduleAssetRoutes(
  app: FastifyInstance,
  options: { apps: Record<string, AppRuntimeConfig> },
) {
  app.get('/modules/:appId/*', async (request, reply) => {
    const params = request.params as { appId: string; '*': string };
    const runtimeApp = options.apps[params.appId];
    if (!runtimeApp) {
      throw new GatewayError('APP_NOT_REGISTERED', `应用未注册：${params.appId}`, 404);
    }
    const assetPath = safeAssetPath(params.appId, params['*']);
    let response: Response;
    try {
      response = await fetch(new URL(assetPath, runtimeApp.frontend.baseUrl), {
        signal: AbortSignal.timeout(runtimeApp.frontend.requestTimeoutMs),
      });
    } catch {
      throw new GatewayError(
        'REMOTE_MODULE_UNAVAILABLE',
        `远程前端暂时不可用：${params.appId}`,
        503,
      );
    }
    const contentType = response.headers.get('content-type');
    const cacheControl = response.headers.get('cache-control');
    if (contentType) reply.header('content-type', contentType);
    if (cacheControl) reply.header('cache-control', cacheControl);
    return reply.code(response.status).send(Buffer.from(await response.arrayBuffer()));
  });
}
