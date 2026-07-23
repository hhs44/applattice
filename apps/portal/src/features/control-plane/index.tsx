import { Badge, Button, Card, Dialog, EmptyState, InlineAlert } from '@applattice/ui';
import type {
  AuditEvent,
  CompatibilityStatus,
  ControlPlaneApplication,
  ControlPlaneSnapshot,
  DeploymentStatus,
  VersionStatus,
} from '@applattice/contracts';
import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import type { FeatureProps, PortalFeature } from '../types.js';
import {
  MockControlPlaneRepository,
  withDemoScenario,
  type DemoScenario,
  type DeveloperStep,
  type GitOpsAction,
  type GitOpsProposal,
} from './repository.js';

const repository = new MockControlPlaneRepository();

const scenarios: Array<{ value: DemoScenario; label: string }> = [
  { value: 'healthy', label: '正常运行' },
  { value: 'incompatible', label: '协议不兼容' },
  { value: 'remote-load-failure', label: '远程加载失败' },
  { value: 'validation-failure', label: '验证失败' },
  { value: 'permission-revoked', label: '权限被撤销' },
  { value: 'rollback-complete', label: '回滚完成' },
];

const sections = [
  { id: 'overview', label: '控制面概览', path: '/control' },
  { id: 'apps', label: '应用治理', path: '/control/apps' },
  { id: 'developer', label: '开发者路径', path: '/control/developer' },
  { id: 'access', label: '身份与权限', path: '/control/access' },
  { id: 'releases', label: '发布与回滚', path: '/control/releases' },
  { id: 'audit', label: '审计记录', path: '/control/audit' },
] as const;

function formatDate(value: string) {
  return new Intl.DateTimeFormat('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(new Date(value));
}

function labelForVersionStatus(status: VersionStatus) {
  return {
    registered: '已注册',
    validating: '验证中',
    validated: '已验证',
    rejected: '已拒绝',
    superseded: '已替代',
  }[status];
}

function labelForDeploymentStatus(status: DeploymentStatus) {
  return {
    pending: '等待部署',
    deploying: '部署中',
    healthy: '健康',
    degraded: '降级',
    failed: '失败',
    rolled_back: '已回滚',
  }[status];
}

function toneForStatus(status: string) {
  if (['healthy', 'validated', 'supported', 'success', 'active'].includes(status)) return 'success';
  if (['degraded', 'deprecated', 'warning'].includes(status)) return 'warning';
  if (['unavailable', 'failed', 'rejected', 'blocked', 'denied'].includes(status)) return 'danger';
  if (['deploying', 'validating', 'pending'].includes(status)) return 'info';
  return 'neutral';
}

function currentScenario(): DemoScenario {
  const value = new URLSearchParams(window.location.search).get('scenario');
  return scenarios.some((item) => item.value === value) ? (value as DemoScenario) : 'healthy';
}

function StatusBadge({ status, label }: { status: string; label: string }) {
  return <Badge tone={toneForStatus(status)}>{label}</Badge>;
}

function Metric({
  label,
  value,
  hint,
  tone,
}: {
  label: string;
  value: string | number;
  hint: string;
  tone: string;
}) {
  return (
    <article className={`cp-metric cp-metric--${tone}`}>
      <span>{label}</span>
      <strong>{value}</strong>
      <small>{hint}</small>
    </article>
  );
}

function Overview({
  snapshot,
  navigate,
}: {
  snapshot: ControlPlaneSnapshot;
  navigate(path: string): void;
}) {
  const active = snapshot.applications.filter((app) => app.status === 'active').length;
  const unhealthy = snapshot.applications.filter((app) => app.health !== 'healthy');
  const healthy = snapshot.applications.length - unhealthy.length;
  const blocked = snapshot.applications
    .flatMap((app) => app.versions[0]?.compatibility ?? [])
    .filter((item) => item.status === 'blocked');

  return (
    <div className="cp-section-stack">
      <section className="cp-metric-grid" aria-label="控制面核心指标">
        <Metric
          label="已治理应用"
          value={snapshot.applications.length}
          hint={`${active} 个处于活动状态`}
          tone="blue"
        />
        <Metric
          label="健康应用"
          value={`${healthy} / ${snapshot.applications.length}`}
          hint={unhealthy.length > 0 ? `${unhealthy.length} 个应用需要关注` : '全部应用健康'}
          tone="green"
        />
        <Metric
          label="待处理兼容项"
          value={blocked.length}
          hint="发布前必须完成治理"
          tone="orange"
        />
        <Metric
          label="活跃用户"
          value={snapshot.users.filter((user) => user.status === 'active').length}
          hint={`${snapshot.groups.length} 个责任组`}
          tone="violet"
        />
      </section>

      <section className="cp-two-column">
        <Card
          title="治理队列"
          action={
            <Button tone="ghost" onClick={() => navigate('/control/apps')}>
              查看全部应用
            </Button>
          }
        >
          <div className="cp-task-list">
            <button onClick={() => navigate('/control/apps/asset-hub')}>
              <span className="cp-task-index">01</span>
              <span>
                <strong>资产中心响应变慢</strong>
                <small>生产服务连续三次超过延迟阈值</small>
              </span>
              <Badge tone="warning">需关注</Badge>
            </button>
            <button onClick={() => navigate('/control/apps/audit-reporter')}>
              <span className="cp-task-index">02</span>
              <span>
                <strong>审计报表处于下线窗口</strong>
                <small>无活动部署，可提交归档提案</small>
              </span>
              <Badge tone="info">可处理</Badge>
            </button>
            <button onClick={() => navigate('/control/access')}>
              <span className="cp-task-index">03</span>
              <span>
                <strong>1 个本地账号已停用</strong>
                <small>会话均已撤销，等待负责人确认</small>
              </span>
              <Badge tone="neutral">已隔离</Badge>
            </button>
          </div>
        </Card>

        <Card title="运行态观察">
          <div className="cp-observation-list">
            {snapshot.healthObservations.slice(0, 4).map((observation) => (
              <article key={observation.id}>
                <span className={`cp-health-dot cp-health-dot--${observation.status}`} />
                <div>
                  <strong>
                    {snapshot.applications.find((app) => app.id === observation.appId)?.title}
                  </strong>
                  <p>{observation.message}</p>
                </div>
                <small>{observation.latencyMs} ms</small>
              </article>
            ))}
          </div>
        </Card>
      </section>

      {unhealthy.length > 0 ? (
        <InlineAlert title="应用故障已被隔离" tone="warning">
          {unhealthy.map((app) => app.title).join('、')} 当前不会影响 Portal 与其他应用。{' '}
          <Button
            tone="ghost"
            onClick={() => {
              const [firstUnhealthy] = unhealthy;
              if (firstUnhealthy) navigate(`/control/apps/${firstUnhealthy.id}`);
            }}
          >
            查看首个故障应用
          </Button>
        </InlineAlert>
      ) : null}
    </div>
  );
}

function Applications({
  snapshot,
  navigate,
}: {
  snapshot: ControlPlaneSnapshot;
  navigate(path: string): void;
}) {
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState('all');
  const filtered = snapshot.applications.filter(
    (app) =>
      (status === 'all' || app.status === status) &&
      `${app.title}${app.id}${app.ownerGroupName}`.toLowerCase().includes(query.toLowerCase()),
  );

  return (
    <Card>
      <div className="cp-toolbar">
        <div>
          <h2>应用目录</h2>
          <p>声明态来自 Git；健康与部署状态来自运行时观测。</p>
        </div>
        <div className="cp-filters">
          <label>
            <span className="sr-only">搜索应用</span>
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="搜索应用、ID 或负责人"
            />
          </label>
          <label>
            <span className="sr-only">应用状态</span>
            <select value={status} onChange={(event) => setStatus(event.target.value)}>
              <option value="all">全部状态</option>
              <option value="active">活动</option>
              <option value="deprecated">下线窗口</option>
              <option value="archived">已归档</option>
            </select>
          </label>
        </div>
      </div>
      {filtered.length === 0 ? (
        <EmptyState title="没有匹配的应用" description="调整搜索词或状态筛选后重试。" />
      ) : (
        <div className="cp-table-wrap">
          <table className="cp-table">
            <thead>
              <tr>
                <th>应用</th>
                <th>负责人</th>
                <th>版本</th>
                <th>生命周期</th>
                <th>运行状态</th>
                <th>
                  <span className="sr-only">操作</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((app) => (
                <tr key={app.id}>
                  <td>
                    <strong>{app.title}</strong>
                    <small>
                      {app.id} · {app.route}
                    </small>
                  </td>
                  <td>{app.ownerGroupName}</td>
                  <td>
                    <code>v{app.latestVersion}</code>
                  </td>
                  <td>
                    <StatusBadge
                      status={app.status}
                      label={
                        { active: '活动', deprecated: '下线窗口', archived: '已归档' }[app.status]
                      }
                    />
                  </td>
                  <td>
                    <StatusBadge
                      status={app.health}
                      label={
                        { healthy: '健康', degraded: '降级', unavailable: '不可用' }[app.health]
                      }
                    />
                  </td>
                  <td>
                    <Button tone="ghost" onClick={() => navigate(`/control/apps/${app.id}`)}>
                      查看详情
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}

function CompatibilityTable({ application }: { application: ControlPlaneApplication }) {
  const compatibility = application.versions[0]?.compatibility ?? [];
  if (compatibility.length === 0)
    return <EmptyState title="暂无兼容性记录" description="该版本尚未生成兼容矩阵。" />;
  return (
    <div className="cp-table-wrap">
      <table className="cp-table cp-table--compact">
        <thead>
          <tr>
            <th>协议</th>
            <th>当前</th>
            <th>要求</th>
            <th>结论</th>
            <th>说明</th>
            <th>修复建议</th>
          </tr>
        </thead>
        <tbody>
          {compatibility.map((item) => (
            <tr key={`${item.component}-${item.code}`}>
              <td>
                <strong>{item.component}</strong>
                <small>{item.code}</small>
              </td>
              <td>
                <code>{item.currentVersion}</code>
              </td>
              <td>
                <code>{item.requiredVersion}</code>
              </td>
              <td>
                <StatusBadge
                  status={item.status}
                  label={{ supported: '支持', deprecated: '待升级', blocked: '阻断' }[item.status]}
                />
              </td>
              <td>{item.message}</td>
              <td>{item.remediation}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ApplicationDetail({
  application,
  onBack,
  onAction,
}: {
  application: ControlPlaneApplication;
  onBack(): void;
  onAction(action: GitOpsAction, appId: string): void;
}) {
  return (
    <div className="cp-section-stack">
      <div className="cp-detail-heading">
        <Button tone="ghost" onClick={onBack}>
          返回应用目录
        </Button>
        <div className="cp-detail-title">
          <div>
            <span className="eyebrow">APPLICATION / {application.id}</span>
            <h2>{application.title}</h2>
            <p>{application.description}</p>
          </div>
          <div className="cp-detail-badges">
            <StatusBadge
              status={application.status}
              label={
                { active: '活动', deprecated: '下线窗口', archived: '已归档' }[application.status]
              }
            />
            <StatusBadge
              status={application.health}
              label={
                { healthy: '运行健康', degraded: '运行降级', unavailable: '当前不可用' }[
                  application.health
                ]
              }
            />
          </div>
        </div>
      </div>

      <section className="cp-detail-grid">
        <Card title="治理信息">
          <dl className="cp-definition-list">
            <div>
              <dt>责任组</dt>
              <dd>{application.ownerGroupName}</dd>
            </div>
            <div>
              <dt>门户路由</dt>
              <dd>
                <code>{application.route}</code>
              </dd>
            </div>
            <div>
              <dt>最新版本</dt>
              <dd>
                <code>v{application.latestVersion}</code>
              </dd>
            </div>
            <div>
              <dt>权限键</dt>
              <dd>{application.permissions.join(' · ')}</dd>
            </div>
          </dl>
        </Card>
        <Card title="GitOps 操作">
          <p className="cp-card-copy">这里仅生成命令和变更预览，不会从 Portal 直接写入 Git。</p>
          <div className="cp-action-grid">
            <Button onClick={() => onAction('upgrade', application.id)}>升级版本</Button>
            <Button tone="secondary" onClick={() => onAction('rollback', application.id)}>
              回滚部署
            </Button>
            <Button tone="ghost" onClick={() => onAction('deprecate', application.id)}>
              进入下线窗口
            </Button>
            <Button tone="danger" onClick={() => onAction('archive', application.id)}>
              归档应用
            </Button>
          </div>
        </Card>
      </section>

      <Card title="协议兼容矩阵">
        <CompatibilityTable application={application} />
      </Card>

      <section className="cp-two-column">
        <Card title="版本历史">
          <div className="cp-timeline">
            {application.versions.map((version) => (
              <article key={version.version}>
                <span className={`cp-timeline__marker cp-timeline__marker--${version.status}`} />
                <div>
                  <strong>v{version.version}</strong>
                  <p>
                    {version.commit} · {formatDate(version.createdAt)}
                  </p>
                  <small>
                    {version.checksPassed}/{version.checksTotal} 项验证通过
                  </small>
                </div>
                <StatusBadge
                  status={version.status}
                  label={labelForVersionStatus(version.status)}
                />
              </article>
            ))}
          </div>
        </Card>
        <Card title="环境部署">
          <div className="cp-timeline">
            {application.deployments.length > 0 ? (
              application.deployments.map((deployment) => (
                <article key={deployment.id}>
                  <span
                    className={`cp-timeline__marker cp-timeline__marker--${deployment.status}`}
                  />
                  <div>
                    <strong>
                      {deployment.environment} · v{deployment.appVersion}
                    </strong>
                    <p>{deployment.id}</p>
                    <small>
                      {deployment.changeTicket} · {formatDate(deployment.createdAt)}
                    </small>
                  </div>
                  <StatusBadge
                    status={deployment.status}
                    label={labelForDeploymentStatus(deployment.status)}
                  />
                </article>
              ))
            ) : (
              <EmptyState title="没有活动部署" description="该应用可以进入归档流程。" />
            )}
          </div>
        </Card>
      </section>
    </div>
  );
}

function DeveloperJourney({
  steps,
  onProposal,
  onSelectStep,
  selectedStepId,
}: {
  steps: DeveloperStep[];
  onProposal(action: GitOpsAction, appId: string): void;
  onSelectStep(stepId: string): void;
  selectedStepId: string;
}) {
  const [running, setRunning] = useState(false);
  const [copied, setCopied] = useState(false);
  const [copyError, setCopyError] = useState(false);
  const copiedTimer = useRef<number | undefined>(undefined);
  const runningTimer = useRef<number | undefined>(undefined);
  const active = steps.find((step) => step.id === selectedStepId) ?? steps[0];

  useEffect(
    () => () => {
      if (copiedTimer.current) window.clearTimeout(copiedTimer.current);
      if (runningTimer.current) window.clearTimeout(runningTimer.current);
    },
    [],
  );

  if (!active) return null;
  const currentStep = active;

  async function copyCommand() {
    try {
      await navigator.clipboard.writeText(currentStep.command);
      setCopyError(false);
      setCopied(true);
      if (copiedTimer.current) window.clearTimeout(copiedTimer.current);
      copiedTimer.current = window.setTimeout(() => setCopied(false), 1400);
    } catch {
      setCopied(false);
      setCopyError(true);
    }
  }

  function simulate() {
    setRunning(true);
    if (runningTimer.current) window.clearTimeout(runningTimer.current);
    runningTimer.current = window.setTimeout(() => setRunning(false), 650);
  }

  function selectStep(index: number) {
    const step = steps[index];
    if (!step) return;
    onSelectStep(step.id);
    window.requestAnimationFrame(() =>
      document.getElementById(`developer-step-${step.id}`)?.focus(),
    );
  }

  function onStepKeyDown(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    let nextIndex: number | undefined;
    if (event.key === 'ArrowRight') nextIndex = (index + 1) % steps.length;
    if (event.key === 'ArrowLeft') nextIndex = (index - 1 + steps.length) % steps.length;
    if (event.key === 'Home') nextIndex = 0;
    if (event.key === 'End') nextIndex = steps.length - 1;
    if (nextIndex === undefined) return;
    event.preventDefault();
    selectStep(nextIndex);
  }

  return (
    <div className="cp-section-stack">
      <Card>
        <div className="cp-toolbar">
          <div>
            <h2>从创建到可信发布</h2>
            <p>命令在本地应用仓库或平台 Git 工作区执行，Portal 只负责解释路径和展示结果。</p>
          </div>
          <Badge tone="info">Todo 清单演练</Badge>
        </div>
        <div className="cp-stepper" role="tablist" aria-label="开发者路径">
          {steps.map((step, index) => (
            <button
              aria-controls="developer-step-panel"
              aria-selected={step.id === active.id}
              className={step.id === active.id ? 'active' : ''}
              id={`developer-step-${step.id}`}
              key={step.id}
              onClick={() => onSelectStep(step.id)}
              onKeyDown={(event) => onStepKeyDown(event, index)}
              role="tab"
              tabIndex={step.id === active.id ? 0 : -1}
            >
              <span>{String(index + 1).padStart(2, '0')}</span>
              <strong>{step.title}</strong>
            </button>
          ))}
        </div>
      </Card>

      {copyError ? (
        <InlineAlert title="无法复制命令" tone="danger">
          浏览器未授予剪贴板权限，请手动选择命令文本复制。
        </InlineAlert>
      ) : null}

      <section
        aria-labelledby={`developer-step-${active.id}`}
        className="cp-dev-grid"
        id="developer-step-panel"
        role="tabpanel"
      >
        <Card title={active.title}>
          <p className="cp-card-copy">{active.description}</p>
          <div className="cp-command">
            <div>
              <span>PowerShell</span>
              <button onClick={copyCommand}>{copied ? '已复制' : '复制命令'}</button>
            </div>
            <code>{active.command}</code>
          </div>
          <div className="cp-dev-actions">
            <Button onClick={simulate} disabled={running}>
              {running ? '正在模拟执行…' : '模拟执行'}
            </Button>
            {active.id === 'register' ? (
              <Button tone="secondary" onClick={() => onProposal('register', 'todo-list')}>
                查看 Git 差异
              </Button>
            ) : null}
            {active.id === 'publish' ? (
              <Button tone="secondary" onClick={() => onProposal('publish', 'todo-list')}>
                预览发布提案
              </Button>
            ) : null}
          </div>
        </Card>
        <Card title="终端与 CI 输出">
          <div className={`cp-terminal ${running ? 'is-running' : ''}`} aria-live="polite">
            <span>$ {active.command}</span>
            {running ? (
              <p>正在执行安全检查…</p>
            ) : (
              active.output.map((line) => <p key={line}>PASS {line}</p>)
            )}
          </div>
        </Card>
      </section>

      <Card title="声明变更预览">
        <div className="cp-diff">
          <span>platform/apps/todo-list/versions/1.4.0.json</span>
          <code>+ "status": "validated"</code>
          <code>+ "bridgeVersion": "1.0.0"</code>
          <code>+ "artifactDigest": "sha256:4a2d…f921"</code>
          <code>+ "reviewRequired": true</code>
        </div>
      </Card>
    </div>
  );
}

function AccessControl({
  snapshot,
  permissionRevoked,
  onSignIn,
}: {
  snapshot: ControlPlaneSnapshot;
  permissionRevoked: boolean;
  onSignIn(): void;
}) {
  const [matrix, setMatrix] = useState({ read: true, write: true, admin: true });
  const [saved, setSaved] = useState(false);

  function save() {
    setSaved(true);
    window.setTimeout(() => setSaved(false), 1600);
  }

  return (
    <div className="cp-section-stack">
      {permissionRevoked ? (
        <InlineAlert title="平台管理权限已撤销" tone="danger">
          当前会话最多在 30 秒内失去管理能力。演示中的保存按钮已禁用，查看权限仍然保留。
        </InlineAlert>
      ) : null}
      <section className="cp-two-column cp-two-column--access">
        <Card title="认证入口" action={<Badge tone="info">Mock</Badge>}>
          <p className="cp-card-copy">
            正式版本支持本地账号与企业 OIDC 联邦，认证后统一创建服务端会话。
          </p>
          <div className="cp-signin-actions">
            <Button onClick={onSignIn}>本地账号登录</Button>
            <Button tone="secondary" onClick={onSignIn}>
              企业 SSO 登录
            </Button>
          </div>
          <small className="cp-security-note">
            会话 Cookie 使用 Secure、HttpOnly、SameSite=Lax；令牌不进入 Web Storage。
          </small>
        </Card>
        <Card title="角色绑定概览">
          <div className="cp-binding-summary">
            <strong>{snapshot.bindings.length}</strong>
            <span>条有效绑定</span>
            <p>
              {snapshot.groups.length} 个组 · {snapshot.roles.length} 个角色 · 单组织作用域
            </p>
          </div>
        </Card>
      </section>

      <Card title="用户与身份">
        <div className="cp-table-wrap">
          <table className="cp-table">
            <thead>
              <tr>
                <th>用户</th>
                <th>登录方式</th>
                <th>状态</th>
                <th>最近活动</th>
              </tr>
            </thead>
            <tbody>
              {snapshot.users.map((user) => (
                <tr key={user.id}>
                  <td>
                    <strong>{user.name}</strong>
                    <small>{user.email}</small>
                  </td>
                  <td>
                    {user.authMethods.map((method) => (
                      <Badge key={method} tone="neutral">
                        {method === 'local' ? '本地' : 'OIDC'}
                      </Badge>
                    ))}
                  </td>
                  <td>
                    <StatusBadge
                      status={user.status}
                      label={user.status === 'active' ? '有效' : '已停用'}
                    />
                  </td>
                  <td>{user.lastActiveAt ? formatDate(user.lastActiveAt) : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <Card
        title="Todo 清单 · 应用负责人权限矩阵"
        action={
          <Button onClick={save} disabled={permissionRevoked}>
            {saved ? '已保存' : '保存 Mock 变更'}
          </Button>
        }
      >
        <div className="cp-permission-matrix">
          <div className="cp-permission-matrix__head">
            <span>主体</span>
            <span>读取</span>
            <span>写入</span>
            <span>管理</span>
          </div>
          <div className="cp-permission-matrix__row">
            <div>
              <strong>平台示例团队</strong>
              <small>app-owner · application scope</small>
            </div>
            {Object.entries(matrix).map(([key, value]) => (
              <label key={key}>
                <input
                  checked={value}
                  disabled={permissionRevoked}
                  onChange={(event) =>
                    setMatrix((current) => ({ ...current, [key]: event.target.checked }))
                  }
                  type="checkbox"
                />
                <span>{value ? '允许' : '拒绝'}</span>
              </label>
            ))}
          </div>
        </div>
      </Card>
    </div>
  );
}

function Releases({
  snapshot,
  onAction,
}: {
  snapshot: ControlPlaneSnapshot;
  onAction(action: GitOpsAction, appId: string): void;
}) {
  const deployments = snapshot.applications.flatMap((app) =>
    app.deployments.map((deployment) => ({ app, deployment })),
  );
  return (
    <Card>
      <div className="cp-toolbar">
        <div>
          <h2>环境发布修订</h2>
          <p>每次发布和回滚都会产生新修订；历史记录不可覆盖。</p>
        </div>
        <Button onClick={() => onAction('publish', 'todo-list')}>生成发布提案</Button>
      </div>
      <div className="cp-table-wrap">
        <table className="cp-table">
          <thead>
            <tr>
              <th>应用</th>
              <th>环境</th>
              <th>版本</th>
              <th>修订</th>
              <th>状态</th>
              <th>变更单</th>
              <th>
                <span className="sr-only">操作</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {deployments.map(({ app, deployment }) => (
              <tr key={deployment.id}>
                <td>
                  <strong>{app.title}</strong>
                  <small>{app.id}</small>
                </td>
                <td>{deployment.environment}</td>
                <td>
                  <code>v{deployment.appVersion}</code>
                </td>
                <td>
                  <code>{deployment.id}</code>
                  {deployment.rollbackOf ? <small>回滚自 {deployment.rollbackOf}</small> : null}
                </td>
                <td>
                  <StatusBadge
                    status={deployment.status}
                    label={labelForDeploymentStatus(deployment.status)}
                  />
                </td>
                <td>{deployment.changeTicket}</td>
                <td>
                  <Button tone="ghost" onClick={() => onAction('rollback', app.id)}>
                    回滚预览
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

function AuditLog({ events }: { events: AuditEvent[] }) {
  const [result, setResult] = useState('all');
  const filtered = events.filter((event) => result === 'all' || event.result === result);
  return (
    <Card>
      <div className="cp-toolbar">
        <div>
          <h2>平台审计记录</h2>
          <p>记录身份、授权和治理操作；不记录密码、令牌或完整敏感载荷。</p>
        </div>
        <label>
          <span className="sr-only">审计结果</span>
          <select value={result} onChange={(event) => setResult(event.target.value)}>
            <option value="all">全部结果</option>
            <option value="success">成功</option>
            <option value="denied">拒绝</option>
            <option value="failed">失败</option>
          </select>
        </label>
      </div>
      <div className="cp-audit-list">
        {filtered.map((event) => (
          <article key={event.id}>
            <div className="cp-audit-time">
              <strong>{formatDate(event.occurredAt)}</strong>
              <span>{event.actor}</span>
            </div>
            <div>
              <strong>{event.action}</strong>
              <p>{event.detail}</p>
              <small>
                {event.target} · {event.correlationId}
              </small>
            </div>
            <StatusBadge
              status={event.result}
              label={{ success: '成功', denied: '拒绝', failed: '失败' }[event.result]}
            />
          </article>
        ))}
      </div>
    </Card>
  );
}

function ProposalDialog({
  proposal,
  onClose,
  onGenerated,
}: {
  proposal: GitOpsProposal | undefined;
  onClose(): void;
  onGenerated(): void;
}) {
  return (
    <Dialog
      open={Boolean(proposal)}
      title={proposal?.title ?? ''}
      description={proposal?.summary}
      onClose={onClose}
      footer={
        <>
          <Button tone="ghost" onClick={onClose}>
            取消
          </Button>
          <Button disabled={Boolean(proposal?.blockedReason)} onClick={onGenerated}>
            生成本地提案
          </Button>
        </>
      }
    >
      {proposal?.blockedReason ? (
        <InlineAlert title="当前操作被阻断" tone="danger">
          {proposal.blockedReason}
        </InlineAlert>
      ) : null}
      <div className="cp-command cp-command--dialog">
        <div>
          <span>建议命令</span>
        </div>
        <code>{proposal?.command}</code>
      </div>
      <div className="cp-diff">
        {proposal?.diff.map((line) => (
          <code key={line}>{line}</code>
        ))}
      </div>
      <p className="cp-dialog-note">
        确认后只会生成本地工作区变更；仍需人工检查、提交 Git 并通过 CI。
      </p>
    </Dialog>
  );
}

function SignInDialog({ open, onClose }: { open: boolean; onClose(): void }) {
  const [method, setMethod] = useState<'local' | 'oidc'>('local');
  const [complete, setComplete] = useState(false);
  return (
    <Dialog
      open={open}
      title="AppLattice 身份入口"
      description="高保真交互样例，不会创建真实会话。"
      onClose={onClose}
      footer={
        <>
          <Button tone="ghost" onClick={onClose}>
            取消
          </Button>
          <Button onClick={() => setComplete(true)}>
            {method === 'local' ? '登录 Mock 会话' : '跳转企业 SSO'}
          </Button>
        </>
      }
    >
      <div className="cp-auth-switch">
        <button
          className={method === 'local' ? 'active' : ''}
          onClick={() => {
            setMethod('local');
            setComplete(false);
          }}
        >
          本地账号
        </button>
        <button
          className={method === 'oidc' ? 'active' : ''}
          onClick={() => {
            setMethod('oidc');
            setComplete(false);
          }}
        >
          企业 SSO
        </button>
      </div>
      {complete ? (
        <InlineAlert title="认证路径演示完成" tone="success">
          正式版本将在服务端创建不透明会话，并由 Gateway 内省权限。
        </InlineAlert>
      ) : method === 'local' ? (
        <div className="cp-form">
          <label>
            用户名
            <input defaultValue="lin.che" />
          </label>
          <label>
            密码
            <input defaultValue="applattice-demo" type="password" />
          </label>
          <small>本地密码将使用 Argon2id 存储；此表单不会提交数据。</small>
        </div>
      ) : (
        <div className="cp-sso-card">
          <strong>企业身份提供方</strong>
          <p>使用 OIDC Authorization Code 流程登录，并把外部身份关联到唯一平台用户。</p>
          <Badge tone="info">sso.intra.example.com</Badge>
        </div>
      )}
    </Dialog>
  );
}

function ControlPlanePage({ currentPath, navigate, controlPlaneMode }: FeatureProps) {
  const [scenario, setScenario] = useState<DemoScenario>(currentScenario);
  const [snapshot, setSnapshot] = useState<ControlPlaneSnapshot>();
  const [steps, setSteps] = useState<DeveloperStep[]>([]);
  const [developerStepId, setDeveloperStepId] = useState('scaffold');
  const [error, setError] = useState<string>();
  const [reloadKey, setReloadKey] = useState(0);
  const [proposal, setProposal] = useState<GitOpsProposal>();
  const [notice, setNotice] = useState<string>();
  const [signInOpen, setSignInOpen] = useState(false);

  useEffect(() => {
    let active = true;
    setSnapshot(undefined);
    setError(undefined);
    const params = new URLSearchParams(window.location.search);
    params.set('scenario', scenario);
    window.history.replaceState({}, '', `${window.location.pathname}?${params.toString()}`);
    void Promise.all([repository.loadSnapshot(scenario), repository.getDeveloperSteps('todo-list')])
      .then(([loadedSnapshot, loadedSteps]) => {
        if (!active) return;
        setSnapshot(loadedSnapshot);
        setSteps(loadedSteps);
      })
      .catch((reason: Error) => {
        if (active) setError(reason.message);
      });
    return () => {
      active = false;
    };
  }, [reloadKey, scenario]);

  async function openProposal(action: GitOpsAction, appId: string) {
    setProposal(await repository.previewProposal(action, appId));
  }

  function navigateWithinControlPlane(path: string) {
    navigate(withDemoScenario(path, scenario));
  }

  function generatedProposal() {
    setProposal(undefined);
    setNotice('Mock 提案已生成：未写入 Git，也未触发真实部署。');
    window.setTimeout(() => setNotice(undefined), 3200);
  }

  const applicationId = currentPath.startsWith('/control/apps/')
    ? currentPath.slice('/control/apps/'.length)
    : undefined;
  const activeSection =
    sections.find(
      (section) =>
        currentPath === section.path ||
        (section.id === 'apps' && currentPath.startsWith('/control/apps/')),
    ) ?? sections[0];
  const activeApplication = applicationId
    ? snapshot?.applications.find((app) => app.id === applicationId)
    : undefined;

  let content = snapshot ? (
    <Overview snapshot={snapshot} navigate={navigateWithinControlPlane} />
  ) : null;
  if (snapshot && activeSection.id === 'apps')
    content = activeApplication ? (
      <ApplicationDetail
        application={activeApplication}
        onAction={openProposal}
        onBack={() => navigateWithinControlPlane('/control/apps')}
      />
    ) : (
      <Applications snapshot={snapshot} navigate={navigateWithinControlPlane} />
    );
  if (snapshot && activeSection.id === 'developer')
    content = (
      <DeveloperJourney
        onProposal={openProposal}
        onSelectStep={setDeveloperStepId}
        selectedStepId={developerStepId}
        steps={steps}
      />
    );
  if (snapshot && activeSection.id === 'access')
    content = (
      <AccessControl
        snapshot={snapshot}
        permissionRevoked={scenario === 'permission-revoked'}
        onSignIn={() => setSignInOpen(true)}
      />
    );
  if (snapshot && activeSection.id === 'releases')
    content = <Releases snapshot={snapshot} onAction={openProposal} />;
  if (snapshot && activeSection.id === 'audit')
    content = <AuditLog events={snapshot.auditEvents} />;

  return (
    <div className="cp-page page-stack">
      <section className="cp-hero">
        <div>
          <div className="cp-title-row">
            <span className="eyebrow">APPLATTICE CONTROL PLANE</span>
            <Badge tone="info">高保真 Mock</Badge>
          </div>
          <h1>应用控制面</h1>
          <p>用统一的声明、身份、生命周期和发布证据治理自治应用。</p>
        </div>
        <label className="cp-scenario">
          <span>演示场景</span>
          <select
            value={scenario}
            onChange={(event) => setScenario(event.target.value as DemoScenario)}
          >
            {scenarios.map((item) => (
              <option key={item.value} value={item.value}>
                {item.label}
              </option>
            ))}
          </select>
        </label>
      </section>

      <nav className="cp-section-nav" aria-label="控制面功能">
        {sections.map((section) => (
          <button
            className={activeSection.id === section.id ? 'active' : ''}
            key={section.id}
            onClick={() => navigateWithinControlPlane(section.path)}
          >
            {section.label}
          </button>
        ))}
      </nav>

      {controlPlaneMode === 'mock' ? (
        <InlineAlert title="当前为设计原型" tone="info">
          数据由 Mock Repository 提供。所有发布、授权和登录操作都不会影响真实系统
          {snapshot ? `，快照时间 ${formatDate(snapshot.generatedAt)}` : ''}。
        </InlineAlert>
      ) : null}
      {notice ? (
        <InlineAlert title="操作完成" tone="success">
          {notice}
        </InlineAlert>
      ) : null}
      {error ? (
        <div className="error-panel" role="alert">
          <strong>控制面暂时不可用</strong>
          <span>{error}</span>
          <Button onClick={() => setReloadKey((value) => value + 1)}>重试加载</Button>
        </div>
      ) : null}
      {!snapshot && !error ? <div className="loading-panel">正在构建控制面快照…</div> : content}

      <ProposalDialog
        proposal={proposal}
        onClose={() => setProposal(undefined)}
        onGenerated={generatedProposal}
      />
      <SignInDialog open={signInOpen} onClose={() => setSignInOpen(false)} />
    </div>
  );
}

export const controlPlaneFeature: PortalFeature = {
  id: 'control-plane',
  title: '应用控制面',
  description: '应用、权限与发布治理',
  path: '/control',
  pathPrefixes: ['/control'],
  navMark: '控',
  requiredPermission: 'platform:admin',
  requiresControlPlane: true,
  component: ControlPlanePage,
};
