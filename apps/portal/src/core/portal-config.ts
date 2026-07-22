export type ThemeChoice = 'light' | 'dark' | 'system';

export type PortalConfig = {
  title: string;
  subtitle: string;
  environment: string;
  version: string;
  layout: 'enterprise-sidebar' | 'modern-topnav' | 'ops-console';
  defaultTheme: ThemeChoice;
  themes: ThemeChoice[];
  primaryColor: string;
};

export async function loadPortalConfig(): Promise<PortalConfig> {
  const response = await fetch('/portal.config.json');
  if (!response.ok) throw new Error('门户配置加载失败');
  return (await response.json()) as PortalConfig;
}
