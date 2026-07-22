import { createModuleFederationConfig, federation } from '@module-federation/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

const federationConfig = createModuleFederationConfig({
  name: 'platform_portal',
  remotes: {},
  shared: {
    react: { singleton: true },
    'react-dom': { singleton: true },
  },
});
const gatewayUrl = process.env.GATEWAY_URL ?? 'http://localhost:4000';

export default defineConfig({
  plugins: [react(), federation(federationConfig)],
  preview: {
    host: '0.0.0.0',
    port: 8080,
    proxy: {
      '/api': gatewayUrl,
      '/health': gatewayUrl,
      '/modules': gatewayUrl,
    },
  },
  server: {
    port: 5173,
    proxy: {
      '/api': gatewayUrl,
      '/health': gatewayUrl,
      '/modules': gatewayUrl,
    },
  },
  build: {
    sourcemap: true,
    target: 'es2022',
  },
});
