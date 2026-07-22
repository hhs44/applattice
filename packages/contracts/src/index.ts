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
