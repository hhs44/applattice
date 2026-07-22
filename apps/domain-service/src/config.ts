export type DomainConfig = {
  host: string;
  port: number;
  serviceName: string;
};

export function loadConfig(env: NodeJS.ProcessEnv = process.env): DomainConfig {
  return {
    host: env.HOST ?? '0.0.0.0',
    port: Number(env.DOMAIN_SERVICE_PORT ?? 4100),
    serviceName: env.SERVICE_NAME ?? 'domain-service',
  };
}
