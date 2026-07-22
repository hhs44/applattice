import { createModuleFederationConfig, federation } from '@module-federation/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

const federationConfig = createModuleFederationConfig({
  name: '__REMOTE_NAME__',
  manifest: true,
  filename: 'remoteEntry.js',
  exposes: { './App': './src/App.tsx' },
  shared: { react: { singleton: true }, 'react-dom': { singleton: true } },
});

export default defineConfig({
  base: '/modules/__APP_ID__/',
  plugins: [react(), federation(federationConfig)],
  server: { host: '0.0.0.0', port: __WEB_PORT__, proxy: { '/api': 'http://localhost:4000' } },
  preview: { host: '0.0.0.0', port: __WEB_PORT__ },
  build: { target: 'es2022', sourcemap: true },
});
