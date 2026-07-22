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
    <div className="topnav-shell">
      <header className="topnav-header">
        <div className="brand">
          <span className="brand-mark">{config.title.slice(0, 1)}</span>
          <strong>{config.title}</strong>
        </div>
        <nav aria-label="平台功能">
          {items.map((item) => (
            <button
              key={item.id}
              className={item.id === activeId ? 'active' : ''}
              onClick={() => onNavigate(item.route)}
            >
              {item.title}
            </button>
          ))}
        </nav>
        <div className="topnav-account">
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
          <span className="avatar">{principal.name.slice(0, 1)}</span>
        </div>
      </header>
      <div className="context-strip">
        <span>{config.environment}</span>
        <span>{config.subtitle}</span>
      </div>
      <main className="content">{children}</main>
    </div>
  );
}
