import { randomUUID } from 'node:crypto';
import type { CreateTestRunRequest, TestRun } from '@applattice/contracts';

export interface RunRepository {
  list(): Promise<TestRun[]>;
  create(input: CreateTestRunRequest, idempotencyKey: string): Promise<TestRun>;
}

const initialRuns: TestRun[] = [
  {
    id: 'RUN-20260720-001',
    name: '高速领航夜间回归',
    environment: 'SIL 集群',
    status: 'running',
    progress: 68,
    createdAt: '2026-07-20T01:20:00.000Z',
  },
  {
    id: 'RUN-20260720-002',
    name: '泊车域融合冒烟测试',
    environment: 'HIL-03',
    status: 'passed',
    progress: 100,
    createdAt: '2026-07-20T00:35:00.000Z',
  },
  {
    id: 'RUN-20260719-017',
    name: '雨雾感知数据回放',
    environment: '数据回放集群',
    status: 'failed',
    progress: 82,
    createdAt: '2026-07-19T13:10:00.000Z',
  },
];

export class InMemoryRunRepository implements RunRepository {
  private readonly runs = [...initialRuns];
  private readonly idempotentResults = new Map<string, TestRun>();

  async list(): Promise<TestRun[]> {
    return [...this.runs];
  }

  async create(input: CreateTestRunRequest, idempotencyKey: string): Promise<TestRun> {
    const existing = this.idempotentResults.get(idempotencyKey);
    if (existing) return existing;

    const run: TestRun = {
      id: `RUN-${randomUUID().slice(0, 8).toUpperCase()}`,
      name: input.name,
      environment: input.environment,
      status: 'queued',
      progress: 0,
      createdAt: new Date().toISOString(),
    };
    this.runs.unshift(run);
    this.idempotentResults.set(idempotencyKey, run);
    return run;
  }
}
