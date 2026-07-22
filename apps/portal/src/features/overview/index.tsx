import { Badge, Card } from '@platform/ui';
import { useEffect, useState } from 'react';
import type { PortalDashboard, TestRun } from '@platform/contracts';
import type { FeatureProps, PortalFeature } from '../types.js';

function statusLabel(status: TestRun['status']) {
  return { queued: '排队中', running: '运行中', passed: '已通过', failed: '失败' }[status];
}

function statusTone(status: TestRun['status']) {
  return { queued: 'neutral', running: 'info', passed: 'success', failed: 'danger' }[status];
}

function OverviewPage({ client, principal }: FeatureProps) {
  const [dashboard, setDashboard] = useState<PortalDashboard>();
  const [error, setError] = useState<string>();

  useEffect(() => {
    void client
      .getDashboard()
      .then(setDashboard)
      .catch((reason: Error) => setError(reason.message));
  }, [client]);

  if (error) return <div className="error-panel">无法加载工作台：{error}</div>;
  if (!dashboard) return <div className="loading-panel">正在汇总平台运行数据…</div>;

  const maxValue = Math.max(...dashboard.trend.map((item) => item.passed + item.failed));
  return (
    <div className="page-stack">
      <section className="hero">
        <div>
          <span className="eyebrow">统一质量工作台</span>
          <h1>早上好，{principal.name}</h1>
          <p>跨域测试正在稳定运行。这里汇总执行、质量与缺陷的最新态势。</p>
        </div>
        <div className="hero__signal">
          <span className="pulse" />
          平台服务正常
        </div>
      </section>

      <section className="metric-grid" aria-label="核心质量指标">
        <article className="metric metric--blue">
          <span>测试用例</span>
          <strong>{dashboard.metrics.totalCases.toLocaleString()}</strong>
          <small>已纳入统一资产目录</small>
        </article>
        <article className="metric metric--orange">
          <span>运行任务</span>
          <strong>{dashboard.metrics.runningJobs}</strong>
          <small>实时调度与执行中</small>
        </article>
        <article className="metric metric--green">
          <span>本周通过率</span>
          <strong>{dashboard.metrics.passRate}%</strong>
          <small>较上周保持稳定</small>
        </article>
        <article className="metric metric--red">
          <span>待闭环缺陷</span>
          <strong>{dashboard.metrics.openDefects}</strong>
          <small>其中 4 个为高优先级</small>
        </article>
      </section>

      <section className="dashboard-grid">
        <Card title="近七日执行趋势" className="trend-card">
          <div className="chart-legend">
            <span className="legend-pass">通过</span>
            <span className="legend-fail">失败</span>
          </div>
          <div className="bar-chart">
            {dashboard.trend.map((point) => (
              <div className="bar-column" key={point.label}>
                <div className="bar-stack" title={`${point.passed} 通过 / ${point.failed} 失败`}>
                  <div
                    className="bar bar--failed"
                    style={{ height: `${(point.failed / maxValue) * 170}px` }}
                  />
                  <div
                    className="bar bar--passed"
                    style={{ height: `${(point.passed / maxValue) * 170}px` }}
                  />
                </div>
                <span>{point.label}</span>
              </div>
            ))}
          </div>
        </Card>

        <Card title="最近运行" className="recent-card">
          <div className="run-list">
            {dashboard.recentRuns.map((run) => (
              <article className="run-row" key={run.id}>
                <div className="run-row__icon">{run.environment.slice(0, 1)}</div>
                <div className="run-row__body">
                  <strong>{run.name}</strong>
                  <span>
                    {run.environment} · {run.id}
                  </span>
                </div>
                <Badge tone={statusTone(run.status)}>{statusLabel(run.status)}</Badge>
              </article>
            ))}
          </div>
        </Card>
      </section>
    </div>
  );
}

export const overviewFeature: PortalFeature = {
  id: 'overview',
  title: '总览',
  description: '质量与执行态势',
  path: '/',
  navMark: '概',
  requiredPermission: 'dashboard:read',
  component: OverviewPage,
};
