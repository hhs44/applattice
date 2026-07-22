import { createModuleFederationConfig, federation } from '@module-federation/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

const mfConfig = createModuleFederationConfig({
  name: 'todo_list_app',
  manifest: true,
  filename: 'remoteEntry.js',
  exposes: { './App': './src/App.tsx' },
  shared: {
    react: { singleton: true },
    'react-dom': { singleton: true },
  },
});

export default defineConfig({
  base: '/modules/todo-list/',
  plugins: [react(), federation(mfConfig)],
  server: {
    host: '0.0.0.0',
    port: 4300,
    proxy: { '/api': 'http://localhost:4000' },
  },
  preview: { host: '0.0.0.0', port: 4300 },
  build: { target: 'es2022', sourcemap: true },
});
