import {
  ControlPlaneSnapshotSchema,
  type ControlPlaneSnapshot,
  type DeploymentStatus,
  type VersionStatus,
} from '@applattice/contracts';

export type DemoScenario =
  | 'healthy'
  | 'incompatible'
  | 'remote-load-failure'
  | 'validation-failure'
  | 'permission-revoked'
  | 'rollback-complete';

export function withDemoScenario(path: string, scenario: DemoScenario): string {
  const [pathname, query = ''] = path.split('?');
  const params = new URLSearchParams(query);
  params.set('scenario', scenario);
  return `${pathname}?${params.toString()}`;
}

export type GitOpsAction =
  'register' | 'publish' | 'upgrade' | 'rollback' | 'deprecate' | 'archive';

export type GitOpsProposal = {
  action: GitOpsAction;
  title: string;
  command: string;
  summary: string;
  diff: string[];
  blockedReason?: string;
};

export type DeveloperStep = {
  id: 'scaffold' | 'doctor' | 'validate' | 'register' | 'dev' | 'publish';
  title: string;
  description: string;
  command: string;
  output: string[];
};

export interface ControlPlaneRepository {
  loadSnapshot(scenario: DemoScenario): Promise<ControlPlaneSnapshot>;
  previewProposal(action: GitOpsAction, appId: string): Promise<GitOpsProposal>;
  getDeveloperSteps(appId: string): Promise<DeveloperStep[]>;
}

const generatedAt = '2026-07-23T08:30:00.000Z';

const baseSnapshot: ControlPlaneSnapshot = {
  generatedAt,
  applications: [
    {
      id: 'todo-list',
      title: 'Todo 清单',
      description: '用于验证 Python 全栈应用接入、权限与离线发布的参考应用。',
      ownerGroupId: 'platform-demo-team',
      ownerGroupName: '平台示例团队',
      status: 'active',
      route: '/todos',
      latestVersion: '1.4.0',
      health: 'healthy',
      permissions: ['todo-list:read', 'todo-list:write', 'todo-list:admin'],
      versions: [
        {
          version: '1.4.0',
          status: 'validated',
          commit: '9ab31f4',
          createdAt: '2026-07-22T11:15:00.000Z',
          checksPassed: 18,
          checksTotal: 18,
          compatibility: [
            {
              component: 'bridge',
              currentVersion: '1.0.0',
              requiredVersion: '^1.0.0',
              status: 'supported',
              code: 'BRIDGE_MAJOR_SUPPORTED',
              message: 'Bridge 主版本位于平台支持窗口内。',
              remediation: '无需操作。',
            },
            {
              component: 'manifest',
              currentVersion: '2',
              requiredVersion: '2',
              status: 'supported',
              code: 'MANIFEST_SCHEMA_CURRENT',
              message: 'Manifest Schema 已是当前版本。',
              remediation: '无需操作。',
            },
            {
              component: 'openapi',
              currentVersion: '3.1.0',
              requiredVersion: '3.0.3 || 3.1.0',
              status: 'supported',
              code: 'OPENAPI_SUPPORTED',
              message: 'OpenAPI 格式与契约版本均通过校验。',
              remediation: '保持消费者契约测试通过。',
            },
          ],
        },
        {
          version: '1.3.2',
          status: 'superseded',
          commit: '36d9b27',
          createdAt: '2026-07-15T09:20:00.000Z',
          checksPassed: 18,
          checksTotal: 18,
          compatibility: [],
        },
      ],
      deployments: [
        {
          id: 'prod-20260722-04',
          environment: 'production',
          appVersion: '1.4.0',
          status: 'healthy',
          createdAt: '2026-07-22T12:05:00.000Z',
          changeTicket: 'CHANGE-1842',
        },
        {
          id: 'test-20260722-07',
          environment: 'test',
          appVersion: '1.4.0',
          status: 'healthy',
          createdAt: '2026-07-22T11:38:00.000Z',
          changeTicket: 'CHANGE-1842',
        },
      ],
    },
    {
      id: 'asset-hub',
      title: '资产中心',
      description: '统一管理研发资产、标签和归属关系。',
      ownerGroupId: 'asset-team',
      ownerGroupName: '资产平台组',
      status: 'active',
      route: '/assets',
      latestVersion: '2.2.1',
      health: 'degraded',
      permissions: ['asset-hub:read', 'asset-hub:write', 'asset-hub:admin'],
      versions: [
        {
          version: '2.2.1',
          status: 'validated',
          commit: 'f8211c0',
          createdAt: '2026-07-21T07:45:00.000Z',
          checksPassed: 16,
          checksTotal: 16,
          compatibility: [
            {
              component: 'ui',
              currentVersion: '0.1.0',
              requiredVersion: '^0.1.0',
              status: 'deprecated',
              code: 'UI_WINDOW_DEPRECATED',
              message: '当前 UI 包仍可运行，但应在下一版本升级。',
              remediation: '将 @applattice/ui 升级至 0.2.x。',
            },
          ],
        },
      ],
      deployments: [
        {
          id: 'prod-20260721-02',
          environment: 'production',
          appVersion: '2.2.1',
          status: 'degraded',
          createdAt: '2026-07-21T08:30:00.000Z',
          changeTicket: 'CHANGE-1816',
        },
      ],
    },
    {
      id: 'audit-reporter',
      title: '审计报表',
      description: '旧版合规报表应用，已进入下线窗口。',
      ownerGroupId: 'governance-team',
      ownerGroupName: '治理与合规组',
      status: 'deprecated',
      route: '/audit-reporter',
      latestVersion: '0.9.8',
      health: 'healthy',
      permissions: ['audit-reporter:read', 'audit-reporter:admin'],
      versions: [
        {
          version: '0.9.8',
          status: 'validated',
          commit: '1dcb7a9',
          createdAt: '2026-06-30T02:10:00.000Z',
          checksPassed: 12,
          checksTotal: 12,
          compatibility: [],
        },
      ],
      deployments: [],
    },
  ],
  users: [
    {
      id: 'user-lin',
      name: '林澈',
      username: 'lin.che',
      email: 'lin.che@applattice.example',
      status: 'active',
      authMethods: ['local', 'oidc'],
      lastActiveAt: '2026-07-23T08:21:00.000Z',
    },
    {
      id: 'user-zhou',
      name: '周宁',
      username: 'zhou.ning',
      email: 'zhou.ning@applattice.example',
      status: 'active',
      authMethods: ['oidc'],
      lastActiveAt: '2026-07-23T07:58:00.000Z',
    },
    {
      id: 'user-qiao',
      name: '乔安',
      username: 'qiao.an',
      email: 'qiao.an@applattice.example',
      status: 'disabled',
      authMethods: ['local'],
    },
  ],
  groups: [
    { id: 'platform-demo-team', name: '平台示例团队', source: 'local', members: 8 },
    { id: 'asset-team', name: '资产平台组', source: 'oidc', members: 14 },
    { id: 'governance-team', name: '治理与合规组', source: 'oidc', members: 6 },
  ],
  roles: [
    {
      id: 'platform-admin',
      name: '平台管理员',
      description: '管理平台配置、身份和应用治理。',
      scope: 'platform',
      permissions: ['platform:admin', 'platform:audit'],
      builtIn: true,
    },
    {
      id: 'app-owner',
      name: '应用负责人',
      description: '管理指定应用的版本、发布和成员授权。',
      scope: 'application',
      permissions: ['todo-list:read', 'todo-list:write', 'todo-list:admin'],
      builtIn: true,
    },
    {
      id: 'auditor',
      name: '审计员',
      description: '只读查看治理状态与审计记录。',
      scope: 'platform',
      permissions: ['platform:audit'],
      builtIn: true,
    },
  ],
  bindings: [
    {
      id: 'binding-01',
      subjectType: 'user',
      subjectId: 'user-lin',
      subjectName: '林澈',
      roleId: 'platform-admin',
      scopeType: 'platform',
    },
    {
      id: 'binding-02',
      subjectType: 'group',
      subjectId: 'platform-demo-team',
      subjectName: '平台示例团队',
      roleId: 'app-owner',
      scopeType: 'application',
      appId: 'todo-list',
    },
  ],
  sessions: [
    {
      id: 'session-01',
      userId: 'user-lin',
      authMethod: 'oidc',
      createdAt: '2026-07-23T07:42:00.000Z',
      expiresAt: '2026-07-23T15:42:00.000Z',
    },
  ],
  auditEvents: [
    {
      id: 'audit-1048',
      occurredAt: '2026-07-23T08:12:00.000Z',
      actor: 'lin.che',
      action: 'role.binding.updated',
      target: 'todo-list / app-owner',
      result: 'success',
      correlationId: 'corr-6f531b',
      detail: '为平台示例团队更新应用负责人角色。',
    },
    {
      id: 'audit-1047',
      occurredAt: '2026-07-23T07:52:00.000Z',
      actor: 'ci-release',
      action: 'application.validation.completed',
      target: 'todo-list@1.4.0',
      result: 'success',
      correlationId: 'corr-d8120a',
      detail: '18 项验证全部通过，允许生成发布提案。',
    },
    {
      id: 'audit-1046',
      occurredAt: '2026-07-23T07:35:00.000Z',
      actor: 'zhou.ning',
      action: 'application.archive.requested',
      target: 'asset-hub',
      result: 'denied',
      correlationId: 'corr-b40e92',
      detail: '生产环境仍有活动部署，归档请求被拒绝。',
    },
  ],
  healthObservations: [
    {
      id: 'health-01',
      appId: 'todo-list',
      source: 'frontend',
      status: 'healthy',
      observedAt: '2026-07-23T08:29:30.000Z',
      latencyMs: 184,
      message: '远程模块加载成功。',
    },
    {
      id: 'health-02',
      appId: 'todo-list',
      source: 'gateway',
      status: 'healthy',
      observedAt: '2026-07-23T08:29:32.000Z',
      latencyMs: 42,
      message: 'Gateway 代理链路正常。',
    },
    {
      id: 'health-03',
      appId: 'asset-hub',
      source: 'service',
      status: 'degraded',
      observedAt: '2026-07-23T08:28:10.000Z',
      latencyMs: 1240,
      message: '上游延迟连续三次超过阈值。',
    },
  ],
};

function cloneSnapshot(): ControlPlaneSnapshot {
  return structuredClone(baseSnapshot);
}

function updateTodo(
  snapshot: ControlPlaneSnapshot,
  values: {
    health?: 'healthy' | 'degraded' | 'unavailable';
    versionStatus?: VersionStatus;
    deploymentStatus?: DeploymentStatus;
  },
) {
  const todo = snapshot.applications.find((app) => app.id === 'todo-list');
  if (!todo) return;
  if (values.health) todo.health = values.health;
  if (values.versionStatus && todo.versions[0]) todo.versions[0].status = values.versionStatus;
  if (values.deploymentStatus && todo.deployments[0]) {
    todo.deployments[0].status = values.deploymentStatus;
  }
}

export class MockControlPlaneRepository implements ControlPlaneRepository {
  async loadSnapshot(scenario: DemoScenario): Promise<ControlPlaneSnapshot> {
    await new Promise((resolve) => globalThis.setTimeout(resolve, 1));
    const snapshot = cloneSnapshot();
    const todo = snapshot.applications.find((app) => app.id === 'todo-list');

    if (scenario === 'incompatible' && todo?.versions[0]) {
      todo.versions[0].compatibility[0] = {
        component: 'bridge',
        currentVersion: '2.0.0',
        requiredVersion: '^1.0.0',
        status: 'blocked',
        code: 'BRIDGE_MAJOR_BLOCKED',
        message: '远程应用 Bridge 主版本超出 Portal 支持窗口。',
        remediation: '将 Bridge 降级至 1.x，或升级 Portal 的兼容策略后重新验证。',
      };
    }
    if (scenario === 'remote-load-failure') {
      updateTodo(snapshot, { health: 'unavailable' });
      snapshot.healthObservations.unshift({
        id: 'health-remote-failed',
        appId: 'todo-list',
        source: 'frontend',
        status: 'unavailable',
        observedAt: generatedAt,
        latencyMs: 8000,
        message: '远程模块加载超时，Portal 已隔离该应用。',
      });
    }
    if (scenario === 'validation-failure') {
      updateTodo(snapshot, { versionStatus: 'rejected' });
      if (todo?.versions[0]) {
        todo.versions[0].checksPassed = 15;
        todo.versions[0].compatibility.push({
          component: 'openapi',
          currentVersion: '1.4.0',
          requiredVersion: 'major bump required',
          status: 'blocked',
          code: 'OPENAPI_BREAKING_CHANGE',
          message: '检测到破坏性字段删除，但契约主版本未升级。',
          remediation: '恢复字段兼容性，或升级 API 主版本并重新生成消费者契约。',
        });
      }
    }
    if (scenario === 'permission-revoked') {
      snapshot.auditEvents.unshift({
        id: 'audit-revoked',
        occurredAt: generatedAt,
        actor: 'security-admin',
        action: 'session.permission.revoked',
        target: 'lin.che / platform:admin',
        result: 'success',
        correlationId: 'corr-revoked',
        detail: '平台管理权限已撤销，最长 30 秒内生效。',
      });
    }
    if (scenario === 'rollback-complete' && todo) {
      updateTodo(snapshot, { deploymentStatus: 'rolled_back' });
      todo.deployments.unshift({
        id: 'prod-20260723-05',
        environment: 'production',
        appVersion: '1.3.2',
        status: 'healthy',
        createdAt: generatedAt,
        changeTicket: 'CHANGE-1851',
        rollbackOf: 'prod-20260722-04',
      });
    }

    return ControlPlaneSnapshotSchema.parse(snapshot);
  }

  async previewProposal(action: GitOpsAction, appId: string): Promise<GitOpsProposal> {
    await new Promise((resolve) => globalThis.setTimeout(resolve, 1));
    const versions: Record<GitOpsAction, { title: string; summary: string; command: string }> = {
      register: {
        title: '注册应用',
        summary: '生成应用声明与首个不可变版本，等待 CI 验证和代码评审。',
        command: `applattice register ..\\${appId} --dry-run`,
      },
      publish: {
        title: '发布到生产环境',
        summary: '创建新的环境发布修订，不直接修改运行中容器。',
        command: `applattice publish ${appId}@1.4.0 --env production --change CHANGE-1852 --dry-run`,
      },
      upgrade: {
        title: '升级应用版本',
        summary: '将已验证版本加入新的发布提案，并保留当前健康版本用于回滚。',
        command: `applattice publish ${appId}@1.5.0 --env production --change CHANGE-1853 --dry-run`,
      },
      rollback: {
        title: '回滚生产部署',
        summary: '创建指向上一健康版本的新部署修订，历史版本和审计保持不变。',
        command: `applattice rollback ${appId} --env production --to 1.3.2 --change CHANGE-1854 --dry-run`,
      },
      deprecate: {
        title: '进入下线窗口',
        summary: '标记应用已弃用并通知负责人，不影响当前部署。',
        command: `applattice lifecycle ${appId} --status deprecated --dry-run`,
      },
      archive: {
        title: '归档应用',
        summary: '仅在没有活动部署时允许归档，所有版本和审计仍会保留。',
        command: `applattice lifecycle ${appId} --status archived --dry-run`,
      },
    };
    const selected = versions[action];
    return {
      action,
      ...selected,
      diff: [
        `+ action: ${action}`,
        `+ application: ${appId}`,
        '+ source: local-git',
        '+ reviewRequired: true',
      ],
      ...(action === 'archive'
        ? { blockedReason: 'Todo 清单仍有 production 活动部署，必须先下线或回滚部署。' }
        : {}),
    };
  }

  async getDeveloperSteps(appId: string): Promise<DeveloperStep[]> {
    return [
      {
        id: 'scaffold',
        title: '创建应用',
        description: '生成独立前端、后端、Manifest 与本地开发壳。',
        command: `pnpm scaffold app ${appId} "Todo 清单" --owner todo-team --backend python --route /${appId} --output ..\\${appId} --register`,
        output: [
          '已生成独立应用仓库',
          '已写入 platform-app.manifest.json',
          '未修改 Portal 业务源码',
        ],
      },
      {
        id: 'doctor',
        title: '检查环境',
        description: '检查运行时、端口、依赖镜像、Git 工作区和离线制品。',
        command: 'pnpm verify:runtime',
        output: [
          'Node 22: ready',
          'pnpm 11: ready',
          'Gateway 4000: available',
          '离线依赖摘要: verified',
        ],
      },
      {
        id: 'validate',
        title: '验证契约',
        description: '校验 Manifest、OpenAPI、兼容矩阵、SBOM 和制品摘要。',
        command: 'pnpm contracts:verify && pnpm hybrid:check -- --strict',
        output: ['Manifest Schema v2: supported', 'OpenAPI 3.1.0: supported', '18 checks passed'],
      },
      {
        id: 'register',
        title: '注册已有应用',
        description: '把已有应用清单和版本声明写入本地平台 Git 工作区，等待评审。',
        command: `pnpm register:app -- ..\\${appId}`,
        output: [
          '已更新 platform/app-catalog.json',
          '已更新服务目录与契约锁',
          '下一步: 查看差异并创建 PR/MR',
        ],
      },
      {
        id: 'dev',
        title: '联合开发',
        description: '启动 Portal、Gateway 和目标应用，验证身份、权限和深链接。',
        command: `pnpm local:dev -- --app ${appId}`,
        output: [
          'Portal: http://127.0.0.1:8080',
          'Gateway: http://127.0.0.1:4000',
          'Todo frontend/backend: ready',
        ],
      },
      {
        id: 'publish',
        title: '验证发布清单',
        description: '验证不可变镜像、变更单和回滚清单，生产变更仍需 Git 评审与 CI。',
        command: 'pnpm release:verify',
        output: ['发布清单结构: verified', '镜像引用: immutable', '回滚清单: present'],
      },
    ];
  }
}
