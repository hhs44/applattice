import { describe, expect, it } from 'vitest';
import { MockControlPlaneRepository, withDemoScenario, type DemoScenario } from './repository.js';

const scenarios: DemoScenario[] = [
  'healthy',
  'incompatible',
  'remote-load-failure',
  'validation-failure',
  'permission-revoked',
  'rollback-complete',
];

describe('MockControlPlaneRepository', () => {
  it('preserves the selected scenario across control-plane navigation', () => {
    expect(withDemoScenario('/control/apps?owner=platform', 'incompatible')).toBe(
      '/control/apps?owner=platform&scenario=incompatible',
    );
  });

  it.each(scenarios)('returns a valid deterministic snapshot for %s', async (scenario) => {
    const repository = new MockControlPlaneRepository();
    const first = await repository.loadSnapshot(scenario);
    const second = await repository.loadSnapshot(scenario);
    expect(first).toEqual(second);
    expect(first.applications.find((app) => app.id === 'todo-list')).toBeDefined();
  });

  it('blocks archive while an active production deployment exists', async () => {
    const proposal = await new MockControlPlaneRepository().previewProposal('archive', 'todo-list');
    expect(proposal.blockedReason).toContain('活动部署');
  });

  it('uses commands that are available from the platform package scripts', async () => {
    const steps = await new MockControlPlaneRepository().getDeveloperSteps('todo-list');
    expect(steps.map((step) => step.command)).toEqual([
      'pnpm scaffold app todo-list "Todo 清单" --owner todo-team --backend python --route /todo-list --output ..\\todo-list --register',
      'pnpm verify:runtime',
      'pnpm contracts:verify && pnpm hybrid:check -- --strict',
      'pnpm register:app -- ..\\todo-list',
      'pnpm local:dev -- --app todo-list',
      'pnpm release:verify',
    ]);
  });

  it('models rollback as a new deployment revision', async () => {
    const snapshot = await new MockControlPlaneRepository().loadSnapshot('rollback-complete');
    const deployments = snapshot.applications.find((app) => app.id === 'todo-list')?.deployments;
    expect(deployments?.[0]?.rollbackOf).toBe('prod-20260722-04');
    expect(deployments?.[0]?.status).toBe('healthy');
    expect(deployments?.[1]?.status).toBe('rolled_back');
  });
});
