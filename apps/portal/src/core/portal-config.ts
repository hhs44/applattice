export type ThemeChoice = 'light' | 'dark' | 'system';
export type ControlPlaneMode = 'disabled' | 'mock' | 'http';

export type PortalConfig = {
  title: string;
  subtitle: string;
  environment: string;
  version: string;
  layout: 'enterprise-sidebar' | 'modern-topnav' | 'ops-console';
  defaultTheme: ThemeChoice;
  themes: ThemeChoice[];
  primaryColor: string;
  controlPlane: {
    mode: ControlPlaneMode;
    baseUrl?: string;
  };
};

export async function loadPortalConfig(): Promise<PortalConfig> {
  const response = await fetch('/portal.config.json');
  if (!response.ok) throw new Error('门户配置加载失败');
  const value = (await response.json()) as Omit<PortalConfig, 'controlPlane'> & {
    controlPlane?: PortalConfig['controlPlane'];
  };
  return {
    ...value,
    controlPlane: value.controlPlane ?? { mode: 'disabled' },
  };
}
