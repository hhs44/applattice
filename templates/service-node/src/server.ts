import { buildApp } from './app.js';

const port = Number(process.env.SERVICE_PORT ?? __PORT__);
const app = buildApp();

await app.listen({ host: '0.0.0.0', port });
