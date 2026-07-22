import {
  PermissionSchema,
  PrincipalSchema,
  type Permission,
  type Principal,
} from '@platform/contracts';
import { createRemoteJWKSet, jwtVerify } from 'jose';
import type { FastifyRequest } from 'fastify';
import type { GatewayConfig } from '../config.js';
import { GatewayError } from '../lib/errors.js';

export type Authenticator = (request: FastifyRequest) => Promise<Principal>;

const defaultDevPermissions: Permission[] = [
  'dashboard:read',
  'runs:read',
  'runs:create',
  'assets:read',
  // <permission-registry>
];

function headerText(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export function createAuthenticator(config: GatewayConfig): Authenticator {
  if (config.auth.mode === 'dev') {
    const appPermissions = Object.values(config.apps).flatMap((app) => [
      app.requiredPermission,
      ...app.permissions.map((rule) => rule.permission),
    ]);
    const developmentPermissions = [...new Set([...defaultDevPermissions, ...appPermissions])];
    return async (request) => {
      const permissionHeader = headerText(request.headers['x-user-permissions']);
      const permissions = permissionHeader
        ? permissionHeader
            .split(',')
            .map((item) => item.trim())
            .map((item) => PermissionSchema.safeParse(item))
            .filter((item) => item.success)
            .map((item) => item.data)
        : developmentPermissions;

      return PrincipalSchema.parse({
        id: headerText(request.headers['x-user-id']) ?? 'dev-engineer',
        name: decodeURIComponent(headerText(request.headers['x-user-name']) ?? '测试工程师'),
        roles: ['tester'],
        permissions,
      });
    };
  }

  const oidcConfig = config.auth;
  const jwks = createRemoteJWKSet(new URL(oidcConfig.jwksUrl));
  return async (request) => {
    const authorization = request.headers.authorization;
    if (!authorization?.startsWith('Bearer ')) {
      throw new GatewayError('UNAUTHENTICATED', '缺少访问令牌', 401);
    }

    try {
      const { payload } = await jwtVerify(authorization.slice(7), jwks, {
        issuer: oidcConfig.issuer,
        audience: oidcConfig.audience,
      });
      const rawPermissions = Array.isArray(payload.permissions) ? payload.permissions : [];
      const permissions = rawPermissions.flatMap((permission) => {
        const result = PermissionSchema.safeParse(permission);
        return result.success ? [result.data] : [];
      });
      const realmAccess = payload.realm_access as { roles?: unknown[] } | undefined;
      return PrincipalSchema.parse({
        id: payload.sub,
        name: payload.name ?? payload.preferred_username ?? payload.sub,
        roles: Array.isArray(realmAccess?.roles)
          ? realmAccess.roles.filter((role) => typeof role === 'string')
          : [],
        permissions,
      });
    } catch (error) {
      if (error instanceof GatewayError) throw error;
      throw new GatewayError('INVALID_TOKEN', '访问令牌无效或已过期', 401);
    }
  };
}

declare module 'fastify' {
  interface FastifyRequest {
    principal: Principal;
  }
}
