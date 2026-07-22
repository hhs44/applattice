import { PLATFORM_BRIDGE_VERSION, type PlatformAppProps } from '@applattice/microfrontend-bridge';
import { Card } from '@applattice/ui';
import './styles.css';

export const bridgeVersion = PLATFORM_BRIDGE_VERSION;

export default function BusinessApp({ principal }: PlatformAppProps) {
  return (
    <div className="business-app page-stack">
      <header className="page-heading">
        <div>
          <span className="eyebrow">独立远程业务应用</span>
          <h1>__APP_TITLE__</h1>
        </div>
      </header>
      <Card title="已连接平台">
        <p>你好，{principal.name}。请从这里开始开发业务页面。</p>
      </Card>
    </div>
  );
}
