import { loadRemote, registerRemotes } from '@module-federation/runtime';
import {
  PLATFORM_BRIDGE_VERSION,
  type PlatformRemoteModule,
} from '@applattice/microfrontend-bridge';
import type { PlatformClient } from '@applattice/sdk';
import type { PortalApp, Principal } from '@applattice/contracts';
import { Component, useEffect, useMemo, useState, type ErrorInfo, type ReactNode } from 'react';

const registeredRemotes = new Set<string>();

function compatibleBridge(remoteVersion: string | undefined): boolean {
  return remoteVersion?.split('.')[0] === PLATFORM_BRIDGE_VERSION.split('.')[0];
}

async function loadRemoteModule(app: PortalApp): Promise<PlatformRemoteModule> {
  if (!registeredRemotes.has(app.frontend.remoteName)) {
    registerRemotes([
      {
        name: app.frontend.remoteName,
        entry: app.frontend.manifestUrl,
      },
    ]);
    registeredRemotes.add(app.frontend.remoteName);
  }
  const expose = app.frontend.module.replace(/^\.\//, '');
  const module = (await Promise.race([
    loadRemote(`${app.frontend.remoteName}/${expose}`),
    new Promise<never>((_resolve, reject) =>
      window.setTimeout(() => reject(new Error('远程前端加载超时')), 8000),
    ),
  ])) as PlatformRemoteModule | null;
  if (!module?.default) throw new Error('远程前端没有暴露 ./App');
  if (!compatibleBridge(module.bridgeVersion)) {
    throw new Error(
      `桥接协议不兼容：Portal ${PLATFORM_BRIDGE_VERSION} / Remote ${module.bridgeVersion ?? 'unknown'}`,
    );
  }
  return module;
}

type RemoteErrorBoundaryProps = { children: ReactNode; resetKey: number };
type RemoteErrorBoundaryState = { error?: Error };

class RemoteErrorBoundary extends Component<RemoteErrorBoundaryProps, RemoteErrorBoundaryState> {
  state: RemoteErrorBoundaryState = {};

  static getDerivedStateFromError(error: Error): RemoteErrorBoundaryState {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Remote application render failed', { error, info });
  }

  componentDidUpdate(previous: RemoteErrorBoundaryProps) {
    if (previous.resetKey !== this.props.resetKey && this.state.error) this.setState({});
  }

  render() {
    if (this.state.error) {
      return <div className="remote-error">业务前端渲染失败：{this.state.error.message}</div>;
    }
    return this.props.children;
  }
}

export function RemoteApp({
  app,
  client,
  principal,
  navigate,
}: {
  app: PortalApp;
  client: PlatformClient;
  principal: Principal;
  navigate(path: string): void;
}) {
  const [attempt, setAttempt] = useState(0);
  const [module, setModule] = useState<PlatformRemoteModule>();
  const [error, setError] = useState<string>();
  const appClient = useMemo(() => client.forApp(app.id), [app.id, client]);

  useEffect(() => {
    let active = true;
    setModule(undefined);
    setError(undefined);
    void loadRemoteModule(app)
      .then((loaded) => {
        if (active) setModule(loaded);
      })
      .catch((reason: Error) => {
        if (active) setError(reason.message);
      });
    return () => {
      active = false;
    };
  }, [app, attempt]);

  if (error) {
    return (
      <section className="remote-error" role="alert">
        <strong>{app.title} 暂时不可用</strong>
        <span>{error}</span>
        <button onClick={() => setAttempt((value) => value + 1)}>重新加载</button>
      </section>
    );
  }
  if (!module) return <div className="loading-panel">正在加载 {app.title}…</div>;
  const RemoteComponent = module.default;
  return (
    <RemoteErrorBoundary resetKey={attempt}>
      <RemoteComponent
        basePath={app.route}
        client={appClient}
        navigate={navigate}
        principal={principal}
      />
    </RemoteErrorBoundary>
  );
}
