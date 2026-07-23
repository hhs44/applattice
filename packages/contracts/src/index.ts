import { z } from 'zod';

export const PermissionSchema = z
  .string()
  .regex(/^[a-z][a-z0-9-]*:[a-z][a-z0-9-]*$/, '权限必须使用 resource:action 格式');
export type Permission = z.infer<typeof PermissionSchema>;

export const PrincipalSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  roles: z.array(z.string()),
  permissions: z.array(PermissionSchema),
});
export type Principal = z.infer<typeof PrincipalSchema>;

export const PortalAppSchema = z.object({
  id: z.string().regex(/^[a-z][a-z0-9-]*$/),
  title: z.string().min(1),
  description: z.string().min(1),
  route: z.string().startsWith('/'),
  navMark: z.string().min(1).max(4),
  requiredPermission: PermissionSchema,
  frontend: z.object({
    version: z.string().regex(/^\d+\.\d+\.\d+$/),
    remoteName: z.string().regex(/^[a-z][a-z0-9_]*$/),
    module: z.literal('./App'),
    bridgeVersion: z.string().regex(/^\d+\.\d+\.\d+$/),
    manifestUrl: z.string().startsWith('/'),
  }),
  apiBasePath: z.string().startsWith('/'),
});
export type PortalApp = z.infer<typeof PortalAppSchema>;

export const PortalAppListSchema = z.object({
  items: z.array(PortalAppSchema),
});
export type PortalAppList = z.infer<typeof PortalAppListSchema>;

export const ApplicationStatusSchema = z.enum(['active', 'deprecated', 'archived']);
export type ApplicationStatus = z.infer<typeof ApplicationStatusSchema>;

export const VersionStatusSchema = z.enum([
  'registered',
  'validating',
  'validated',
  'rejected',
  'superseded',
]);
export type VersionStatus = z.infer<typeof VersionStatusSchema>;

export const DeploymentStatusSchema = z.enum([
  'pending',
  'deploying',
  'healthy',
  'degraded',
  'failed',
  'rolled_back',
]);
export type DeploymentStatus = z.infer<typeof DeploymentStatusSchema>;

export const CompatibilityStatusSchema = z.enum(['supported', 'deprecated', 'blocked']);
export type CompatibilityStatus = z.infer<typeof CompatibilityStatusSchema>;

export const CompatibilityResultSchema = z.object({
  component: z.enum(['bridge', 'sdk', 'ui', 'manifest', 'openapi', 'platform']),
  currentVersion: z.string().min(1),
  requiredVersion: z.string().min(1),
  status: CompatibilityStatusSchema,
  code: z.string().min(1),
  message: z.string().min(1),
  remediation: z.string().min(1),
});
export type CompatibilityResult = z.infer<typeof CompatibilityResultSchema>;

export const ApplicationVersionSchema = z.object({
  version: z.string().regex(/^\d+\.\d+\.\d+$/),
  status: VersionStatusSchema,
  commit: z.string().min(7),
  createdAt: z.string().datetime(),
  compatibility: z.array(CompatibilityResultSchema),
  checksPassed: z.number().int().nonnegative(),
  checksTotal: z.number().int().positive(),
});
export type ApplicationVersion = z.infer<typeof ApplicationVersionSchema>;

export const DeploymentRevisionSchema = z.object({
  id: z.string().min(1),
  environment: z.string().min(1),
  appVersion: z.string().regex(/^\d+\.\d+\.\d+$/),
  status: DeploymentStatusSchema,
  createdAt: z.string().datetime(),
  changeTicket: z.string().min(1),
  rollbackOf: z.string().min(1).optional(),
});
export type DeploymentRevision = z.infer<typeof DeploymentRevisionSchema>;

export const ControlPlaneApplicationSchema = z.object({
  id: z.string().regex(/^[a-z][a-z0-9-]*$/),
  title: z.string().min(1),
  description: z.string().min(1),
  ownerGroupId: z.string().min(1),
  ownerGroupName: z.string().min(1),
  status: ApplicationStatusSchema,
  route: z.string().startsWith('/'),
  latestVersion: z.string().regex(/^\d+\.\d+\.\d+$/),
  health: z.enum(['healthy', 'degraded', 'unavailable']),
  permissions: z.array(PermissionSchema),
  versions: z.array(ApplicationVersionSchema),
  deployments: z.array(DeploymentRevisionSchema),
});
export type ControlPlaneApplication = z.infer<typeof ControlPlaneApplicationSchema>;

export const ControlPlaneUserSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  username: z.string().min(1),
  email: z.email(),
  status: z.enum(['active', 'disabled']),
  authMethods: z.array(z.enum(['local', 'oidc'])).min(1),
  lastActiveAt: z.string().datetime().optional(),
});
export type ControlPlaneUser = z.infer<typeof ControlPlaneUserSchema>;

export const ControlPlaneGroupSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  source: z.enum(['local', 'oidc']),
  members: z.number().int().nonnegative(),
});
export type ControlPlaneGroup = z.infer<typeof ControlPlaneGroupSchema>;

export const ControlPlaneRoleSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  description: z.string().min(1),
  scope: z.enum(['platform', 'application']),
  permissions: z.array(PermissionSchema),
  builtIn: z.boolean(),
});
export type ControlPlaneRole = z.infer<typeof ControlPlaneRoleSchema>;

export const RoleBindingSchema = z.object({
  id: z.string().min(1),
  subjectType: z.enum(['user', 'group']),
  subjectId: z.string().min(1),
  subjectName: z.string().min(1),
  roleId: z.string().min(1),
  scopeType: z.enum(['platform', 'application']),
  appId: z
    .string()
    .regex(/^[a-z][a-z0-9-]*$/)
    .optional(),
});
export type RoleBinding = z.infer<typeof RoleBindingSchema>;

export const ControlPlaneSessionSchema = z.object({
  id: z.string().min(1),
  userId: z.string().min(1),
  authMethod: z.enum(['local', 'oidc']),
  createdAt: z.string().datetime(),
  expiresAt: z.string().datetime(),
  revokedAt: z.string().datetime().optional(),
});
export type ControlPlaneSession = z.infer<typeof ControlPlaneSessionSchema>;

export const AuditEventSchema = z.object({
  id: z.string().min(1),
  occurredAt: z.string().datetime(),
  actor: z.string().min(1),
  action: z.string().min(1),
  target: z.string().min(1),
  result: z.enum(['success', 'denied', 'failed']),
  correlationId: z.string().min(1),
  detail: z.string().min(1),
});
export type AuditEvent = z.infer<typeof AuditEventSchema>;

export const HealthObservationSchema = z.object({
  id: z.string().min(1),
  appId: z.string().regex(/^[a-z][a-z0-9-]*$/),
  source: z.enum(['frontend', 'gateway', 'service']),
  status: z.enum(['healthy', 'degraded', 'unavailable']),
  observedAt: z.string().datetime(),
  latencyMs: z.number().int().nonnegative(),
  message: z.string().min(1),
});
export type HealthObservation = z.infer<typeof HealthObservationSchema>;

export const ControlPlaneSnapshotSchema = z.object({
  generatedAt: z.string().datetime(),
  applications: z.array(ControlPlaneApplicationSchema),
  users: z.array(ControlPlaneUserSchema),
  groups: z.array(ControlPlaneGroupSchema),
  roles: z.array(ControlPlaneRoleSchema),
  bindings: z.array(RoleBindingSchema),
  sessions: z.array(ControlPlaneSessionSchema),
  auditEvents: z.array(AuditEventSchema),
  healthObservations: z.array(HealthObservationSchema),
});
export type ControlPlaneSnapshot = z.infer<typeof ControlPlaneSnapshotSchema>;

export const RunStatusSchema = z.enum(['queued', 'running', 'passed', 'failed']);
export type RunStatus = z.infer<typeof RunStatusSchema>;

export const TestRunSchema = z.object({
  id: z.string(),
  name: z.string(),
  environment: z.string(),
  status: RunStatusSchema,
  progress: z.number().int().min(0).max(100),
  createdAt: z.string().datetime(),
});
export type TestRun = z.infer<typeof TestRunSchema>;

export const CreateTestRunRequestSchema = z.object({
  name: z.string().trim().min(2).max(80),
  environment: z.string().trim().min(1).max(40),
});
export type CreateTestRunRequest = z.infer<typeof CreateTestRunRequestSchema>;

export const DashboardMetricsSchema = z.object({
  totalCases: z.number().int().nonnegative(),
  runningJobs: z.number().int().nonnegative(),
  passRate: z.number().min(0).max(100),
  openDefects: z.number().int().nonnegative(),
});

export const TrendPointSchema = z.object({
  label: z.string(),
  passed: z.number().int().nonnegative(),
  failed: z.number().int().nonnegative(),
});

export const DomainDashboardSchema = z.object({
  metrics: DashboardMetricsSchema,
  trend: z.array(TrendPointSchema),
  recentRuns: z.array(TestRunSchema),
});
export type DomainDashboard = z.infer<typeof DomainDashboardSchema>;

export const PortalDashboardSchema = DomainDashboardSchema.extend({
  viewer: PrincipalSchema,
  generatedAt: z.string().datetime(),
});
export type PortalDashboard = z.infer<typeof PortalDashboardSchema>;

export const ApiErrorSchema = z.object({
  code: z.string(),
  message: z.string(),
  correlationId: z.string(),
  details: z.unknown().optional(),
});
export type ApiError = z.infer<typeof ApiErrorSchema>;

export const TestRunListSchema = z.object({
  items: z.array(TestRunSchema),
  total: z.number().int().nonnegative(),
});
export type TestRunList = z.infer<typeof TestRunListSchema>;
