ARG NODE_IMAGE=node:22-alpine
ARG NGINX_IMAGE=nginx:1.27-alpine
FROM ${NODE_IMAGE} AS builder
WORKDIR /app
RUN corepack enable
COPY package.json pnpm-workspace.yaml ./
COPY vendor ./vendor
COPY frontend/package.json ./frontend/package.json
RUN pnpm install --frozen-lockfile=false
COPY frontend ./frontend
RUN pnpm --dir frontend build

FROM ${NGINX_IMAGE} AS runtime
COPY frontend/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=builder /app/frontend/dist /usr/share/nginx/html
EXPOSE 4300
