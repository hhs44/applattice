import type { Permission, Principal } from '@applattice/contracts';
import type { PlatformClient } from '@applattice/sdk';
import type { ComponentType } from 'react';

export type FeatureProps = {
  client: PlatformClient;
  principal: Principal;
};

export type PortalFeature = {
  id: string;
  title: string;
  description: string;
  path: string;
  navMark: string;
  requiredPermission?: Permission;
  component: ComponentType<FeatureProps>;
};
