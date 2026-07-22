import type { FastifyInstance } from 'fastify';
import { dashboardRoutes } from './dashboard/routes.js';
import { InMemoryRunRepository } from './runs/repository.js';
import { runRoutes } from './runs/routes.js';
// <module-imports>

export async function registerDomainModules(app: FastifyInstance) {
  const runRepository = new InMemoryRunRepository();

  await app.register(dashboardRoutes, {
    prefix: '/dashboard',
    repository: runRepository,
  });
  await app.register(runRoutes, {
    prefix: '/test-runs',
    repository: runRepository,
  });
  // <module-registry>
}
