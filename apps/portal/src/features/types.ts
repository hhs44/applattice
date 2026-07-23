import type { Permission, Principal } from '@applattice/contracts';
import type { PlatformClient } from '@applattice/sdk';
import type { ComponentType } from 'react';
import type { ControlPlaneMode } from '../core/portal-config.js';

export type FeatureProps = {
  client: PlatformClient;
  principal: Principal;
  currentPath: string;
  controlPlaneMode: ControlPlaneMode;
  remoteAppCount: number;
  navigate(path: string): void;
};

export type PortalFeature = {
  id: string;
  title: string;
  description: string;
  path: string;
  pathPrefixes?: string[];
  navMark: string;
  requiredPermission?: Permission;
  requiresControlPlane?: boolean;
  component: ComponentType<FeatureProps>;
};
