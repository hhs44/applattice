import type { Principal } from '@applattice/contracts';
import type { ReactNode } from 'react';
import type { PortalConfig, ThemeChoice } from '../../core/portal-config.js';

export type PortalNavItem = {
  id: string;
  title: string;
  description: string;
  route: string;
  navMark: string;
};

export function PortalLayout({
  config,
  principal,
  items,
  activeId,
  theme,
  onThemeChange,
  onNavigate,
  children,
}: {
  config: PortalConfig;
  principal: Principal;
  items: PortalNavItem[];
  activeId: string;
  theme: ThemeChoice;
  onThemeChange(theme: ThemeChoice): void;
  onNavigate(path: string): void;
  children: ReactNode;
}) {
  return (
    <div className="ops-shell">
      <header className="ops-header">
        <strong>
          <span className="status-dot" />
          {config.title}
        </strong>
        <div>
          {config.environment} · v{config.version}
        </div>
        <select
          aria-label="主题"
          value={theme}
          onChange={(event) => onThemeChange(event.target.value as ThemeChoice)}
        >
          {config.themes.map((value) => (
            <option key={value} value={value}>
              {value}
            </option>
          ))}
        </select>
      </header>
      <aside className="ops-nav">
        <div className="ops-user">
          <span>{principal.name.slice(0, 1)}</span>
          <small>{principal.name}</small>
        </div>
        <nav aria-label="平台功能">
          {items.map((item) => (
            <button
              title={item.description}
              key={item.id}
              className={item.id === activeId ? 'active' : ''}
              onClick={() => onNavigate(item.route)}
            >
              <span>{item.navMark}</span>
              {item.title}
            </button>
          ))}
        </nav>
      </aside>
      <main className="content">{children}</main>
    </div>
  );
}
