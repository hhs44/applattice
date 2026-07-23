import { overviewFeature } from './overview/index.js';
import { controlPlaneFeature } from './control-plane/index.js';
// <module-imports>
import type { PortalFeature } from './types.js';

export const portalFeatures: PortalFeature[] = [
  overviewFeature,
  controlPlaneFeature,
  // <module-registry>
];
