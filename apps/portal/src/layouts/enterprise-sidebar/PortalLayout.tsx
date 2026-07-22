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
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-mark">{config.title.slice(0, 1).toUpperCase()}</div>
          <div>
            <strong>{config.title}</strong>
            <span>{config.subtitle}</span>
          </div>
        </div>
        <nav aria-label="平台功能">
          <span className="nav-section">工作空间</span>
          {items.map((item) => (
            <button
              key={item.id}
              className={item.id === activeId ? 'active' : ''}
              onClick={() => onNavigate(item.route)}
            >
              <span className="nav-mark">{item.navMark}</span>
              <span>
                <strong>{item.title}</strong>
                <small>{item.description}</small>
              </span>
            </button>
          ))}
        </nav>
        <div className="sidebar-footer">
          <span className="avatar">{principal.name.slice(0, 1)}</span>
          <div>
            <strong>{principal.name}</strong>
            <small>{principal.roles.join(' · ')}</small>
          </div>
        </div>
      </aside>
      <div className="workspace">
        <header className="topbar">
          <div className="environment">
            <span />
            {config.environment}
          </div>
          <div className="topbar-actions">
            <label>
              <span className="sr-only">主题</span>
              <select
                aria-label="主题"
                value={theme}
                onChange={(event) => onThemeChange(event.target.value as ThemeChoice)}
              >
                {config.themes.map((candidate) => (
                  <option key={candidate} value={candidate}>
                    {candidate === 'light' ? '明亮' : candidate === 'dark' ? '深色' : '跟随系统'}
                  </option>
                ))}
              </select>
            </label>
            <span className="topbar-separator" />
            <span>平台版本 {config.version}</span>
          </div>
        </header>
        <main className="content">{children}</main>
      </div>
    </div>
  );
}
