import { describe, expect, it } from 'vitest';
import { CreateTestRunRequestSchema, PermissionSchema, PrincipalSchema } from './index.js';

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
});
