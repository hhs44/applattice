import {
  DomainDashboardSchema,
  TestRunListSchema,
  TestRunSchema,
  type CreateTestRunRequest,
  type DomainDashboard,
  type TestRun,
  type TestRunList,
} from '@platform/contracts';
import type { Principal } from '@platform/contracts';
import type { ServiceClient } from './service-client.js';

export interface DomainClient {
  getDashboard(context: CallContext): Promise<DomainDashboard>;
  listRuns(context: CallContext): Promise<TestRunList>;
  createRun(
    input: CreateTestRunRequest,
    idempotencyKey: string,
    context: CallContext,
  ): Promise<TestRun>;
  isReady(): Promise<boolean>;
}

export type CallContext = {
  correlationId: string;
  principal: Principal;
};

export function createDomainClient(serviceClient: ServiceClient): DomainClient {
  return {
    async getDashboard(context) {
      return DomainDashboardSchema.parse(
        await serviceClient.request('domain-service', '/api/v1/dashboard', context),
      );
    },
    async listRuns(context) {
      return TestRunListSchema.parse(
        await serviceClient.request('domain-service', '/api/v1/test-runs', context),
      );
    },
    async createRun(input, idempotencyKey, context) {
      return TestRunSchema.parse(
        await serviceClient.request('domain-service', '/api/v1/test-runs', context, {
          method: 'POST',
          headers: { 'idempotency-key': idempotencyKey },
          body: JSON.stringify(input),
        }),
      );
    },
    async isReady() {
      return serviceClient.isReady('domain-service');
    },
  };
}
