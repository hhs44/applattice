ARG NODE_IMAGE=node:22-alpine
FROM ${NODE_IMAGE} AS builder
WORKDIR /app
RUN corepack enable
COPY package.json ./
RUN pnpm install --prefer-offline
COPY tsconfig.json ./
COPY src ./src
RUN pnpm build && pnpm prune --prod

FROM ${NODE_IMAGE} AS runtime
ENV NODE_ENV=production
WORKDIR /app
COPY --from=builder --chown=node:node /app/package.json ./package.json
COPY --from=builder --chown=node:node /app/node_modules ./node_modules
COPY --from=builder --chown=node:node /app/dist ./dist
USER node
CMD ["node", "dist/server.js"]
