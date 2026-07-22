import type { FastifyInstance } from 'fastify';
import type { RunRepository } from '../runs/repository.js';

export async function dashboardRoutes(
  app: FastifyInstance,
  options: { repository: RunRepository },
) {
  app.get('/', async () => {
    const recentRuns = await options.repository.list();
    return {
      metrics: {
        totalCases: 12846,
        runningJobs: recentRuns.filter((run) => run.status === 'running').length,
        passRate: 96.8,
        openDefects: 27,
      },
      trend: [
        { label: '周一', passed: 1260, failed: 42 },
        { label: '周二', passed: 1480, failed: 51 },
        { label: '周三', passed: 1390, failed: 36 },
        { label: '周四', passed: 1720, failed: 48 },
        { label: '周五', passed: 1610, failed: 31 },
        { label: '周六', passed: 980, failed: 22 },
        { label: '周日', passed: 1180, failed: 38 },
      ],
      recentRuns: recentRuns.slice(0, 5),
    };
  });
}
