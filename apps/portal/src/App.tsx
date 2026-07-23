import type { PortalApp, Principal } from '@applattice/contracts';
import { createPlatformClient, hasPermission } from '@applattice/sdk';
import { Button } from '@applattice/ui';
import { useEffect, useMemo, useState } from 'react';
import { loadPortalConfig, type PortalConfig } from './core/portal-config.js';
import { RemoteApp } from './core/RemoteApp.js';
import { useTheme } from './core/use-theme.js';
import { portalFeatures } from './features/registry.js';
import { PortalLayout, type PortalNavItem } from './layouts/enterprise-sidebar/PortalLayout.js';

const client = createPlatformClient();

function currentPath() {
  return window.location.pathname.replace(/\/$/, '') || '/';
}

function ReadyPortal({
  config,
  principal,
  remoteApps,
}: {
  config: PortalConfig;
  principal: Principal;
  remoteApps: PortalApp[];
}) {
  const [path, setPath] = useState(currentPath);
  const { theme, setTheme } = useTheme(config.defaultTheme);

  useEffect(() => {
    const onPopState = () => setPath(currentPath());
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  const localFeatures = useMemo(
    () =>
      portalFeatures.filter(
        (feature) =>
          hasPermission(principal, feature.requiredPermission) &&
          (!feature.requiresControlPlane || config.controlPlane.mode !== 'disabled'),
      ),
    [config.controlPlane.mode, principal],
  );
  const visibleRemoteApps = useMemo(
    () => remoteApps.filter((app) => hasPermission(principal, app.requiredPermission)),
    [principal, remoteApps],
  );
  const activeRemote = visibleRemoteApps.find(
    (app) => path === app.route || path.startsWith(`${app.route}/`),
  );
  const activeLocal = activeRemote
    ? undefined
    : localFeatures.find(
        (feature) =>
          feature.path === path ||
          feature.pathPrefixes?.some((prefix) => path.startsWith(`${prefix}/`)),
      );

  function navigate(nextPath: string) {
    window.history.pushState({}, '', nextPath);
    setPath(currentPath());
  }

  const items: PortalNavItem[] = [
    ...localFeatures.map((feature) => ({
      id: feature.id,
      title: feature.title,
      description: feature.description,
      route: feature.path,
      navMark: feature.navMark,
    })),
    ...visibleRemoteApps.map((app) => ({
      id: app.id,
      title: app.title,
      description: app.description,
      route: app.route,
      navMark: app.navMark,
    })),
  ];

  if (items.length === 0) {
    return <div className="boot-screen">当前用户没有可访问的门户功能</div>;
  }

  const ActiveLocalComponent = activeLocal?.component;
  return (
    <PortalLayout
      activeId={activeRemote?.id ?? activeLocal?.id ?? ''}
      config={config}
      items={items}
      onNavigate={navigate}
      onThemeChange={setTheme}
      principal={principal}
      runtimeModeLabel={visibleRemoteApps.length > 0 ? '完整联调模式' : '平台内核模式'}
      theme={theme}
    >
      {activeRemote ? (
        <RemoteApp app={activeRemote} client={client} navigate={navigate} principal={principal} />
      ) : ActiveLocalComponent ? (
        <ActiveLocalComponent
          client={client}
          controlPlaneMode={config.controlPlane.mode}
          currentPath={path}
          navigate={navigate}
          principal={principal}
          remoteAppCount={visibleRemoteApps.length}
        />
      ) : (
        <section className="error-panel" role="alert">
          <strong>页面不存在</strong>
          <span>当前地址没有对应的门户功能，可能是链接已失效或应用尚未加载。</span>
          <Button onClick={() => navigate('/')}>返回总览</Button>
        </section>
      )}
    </PortalLayout>
  );
}

export function App() {
  const [config, setConfig] = useState<PortalConfig>();
  const [principal, setPrincipal] = useState<Principal>();
  const [remoteApps, setRemoteApps] = useState<PortalApp[]>([]);
  const [error, setError] = useState<string>();
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    setConfig(undefined);
    setPrincipal(undefined);
    setRemoteApps([]);
    setError(undefined);
    void Promise.all([loadPortalConfig(), client.getSession(), client.listApps()])
      .then(([loadedConfig, loadedPrincipal, apps]) => {
        if (controller.signal.aborted) return;
        document.documentElement.style.setProperty('--brand-primary', loadedConfig.primaryColor);
        setConfig(loadedConfig);
        setPrincipal(loadedPrincipal);
        setRemoteApps(apps.items);
      })
      .catch((reason: Error) => {
        if (!controller.signal.aborted) setError(reason.message);
      });
    return () => controller.abort();
  }, [attempt]);

  if (error) {
    return (
      <main className="boot-screen" role="alert">
        <div className="brand-mark">A</div>
        <h1>无法进入统一门户</h1>
        <p>{error}</p>
        <Button onClick={() => setAttempt((value) => value + 1)}>重试加载</Button>
      </main>
    );
  }
  if (!config || !principal) {
    return (
      <main className="boot-screen">
        <div className="brand-mark">A</div>
        <h1>AppLattice</h1>
        <p>正在建立安全会话并加载应用目录…</p>
      </main>
    );
  }
  return <ReadyPortal config={config} principal={principal} remoteApps={remoteApps} />;
}
