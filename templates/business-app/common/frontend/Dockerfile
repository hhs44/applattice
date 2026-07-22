FROM node:22-alpine AS build
WORKDIR /workspace
COPY frontend/package.json ./frontend/package.json
COPY vendor ./vendor
RUN corepack enable && cd frontend && pnpm install --frozen-lockfile=false
COPY frontend ./frontend
RUN cd frontend && pnpm build

FROM nginx:1.27-alpine
COPY frontend/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /workspace/frontend/dist /usr/share/nginx/html
