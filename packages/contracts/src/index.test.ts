import { describe, expect, it } from 'vitest';
import {
  ApplicationStatusSchema,
  ControlPlaneSnapshotSchema,
  CreateTestRunRequestSchema,
  DeploymentStatusSchema,
  PermissionSchema,
  PrincipalSchema,
  VersionStatusSchema,
} from './index.js';

describe('platform contracts', () => {
  it('rejects invalid test run input', () => {
    expect(CreateTestRunRequestSchema.safeParse({ name: '', environment: 'SIL' }).success).toBe(
      false,
    );
  });

  it('accepts a known permission set', () => {
    const result = PrincipalSchema.safeParse({
      id: 'engineer-1',
      name: '测试工程师',
      roles: ['tester'],
      permissions: ['dashboard:read', 'runs:read'],
    });
    expect(result.success).toBe(true);
  });

  it('accepts application-scoped permissions and rejects malformed values', () => {
    expect(PermissionSchema.parse('quality-assets:write')).toBe('quality-assets:write');
    expect(PermissionSchema.safeParse('ADMIN').success).toBe(false);
  });

  it('keeps application, version, and deployment lifecycle states separate', () => {
    expect(ApplicationStatusSchema.parse('active')).toBe('active');
    expect(VersionStatusSchema.parse('validated')).toBe('validated');
    expect(DeploymentStatusSchema.parse('rolled_back')).toBe('rolled_back');
    expect(ApplicationStatusSchema.safeParse('deploying').success).toBe(false);
  });

  it('validates an empty control-plane snapshot envelope', () => {
    expect(
      ControlPlaneSnapshotSchema.safeParse({
        generatedAt: '2026-07-23T08:00:00.000Z',
        applications: [],
        users: [],
        groups: [],
        roles: [],
        bindings: [],
        sessions: [],
        auditEvents: [],
        healthObservations: [],
      }).success,
    ).toBe(true);
  });
});
