import type { ComponentType } from 'react';

export const PLATFORM_BRIDGE_VERSION = '1.0.0';

export type PlatformPrincipal = {
  id: string;
  name: string;
  roles: string[];
  permissions: string[];
};

export type PlatformAppRequest = {
  path: string;
  method?: string;
  body?: unknown;
  idempotencyKey?: string;
};

export type PlatformAppClient = {
  request<T>(options: PlatformAppRequest): Promise<T>;
};

export type PlatformAppProps = {
  basePath: string;
  principal: PlatformPrincipal;
  client: PlatformAppClient;
  navigate(path: string): void;
};

export type PlatformRemoteModule = {
  default: ComponentType<PlatformAppProps>;
  bridgeVersion?: string;
};
