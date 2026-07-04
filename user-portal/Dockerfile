# =============================================================================
# MintPop API user-portal 镜像（debian-slim + mise 构建 → nginx 托管）
# =============================================================================
FROM debian:13-slim AS build

ENV MISE_VERSION=2026.6.0
ENV MISE_DATA_DIR=/mise MISE_CONFIG_DIR=/mise MISE_CACHE_DIR=/mise/cache \
    MISE_INSTALL_PATH=/usr/local/bin/mise PATH=/mise/shims:$PATH
# mise run 默认会自动安装 mise.toml 全部 [tools]；本镜像只显式装 node/pnpm，故关掉自动安装
ENV MISE_TASK_RUN_AUTO_INSTALL=false
RUN apt-get update \
    && apt-get install -y --no-install-recommends curl git ca-certificates \
    && rm -rf /var/lib/apt/lists/* \
    && curl https://mise.run | sh

WORKDIR /app
COPY mise.toml ./
# node 显式装 22.23.1：根 [tools] 的 node 是 frontend/backend 用的 20.18.1，
# user-portal 工具链（Vite 8 等）需 Node 22，与根 mise.toml 各 user-portal task 的 tools 覆盖同步
RUN mise trust && mise install node@22.23.1 pnpm

COPY user-portal/package.json user-portal/pnpm-lock.yaml ./user-portal/
RUN mise run install-user-portal --frozen
COPY user-portal/ ./user-portal/
# 发版构建：mise run build-user-portal --env prod（= vite build --mode prod，加载 .env.prod，含 VITE_PORTAL_LOCALE）
RUN mise run build-user-portal --env prod

# -----------------------------------------------------------------------------
FROM nginx:1.27-alpine AS runtime
COPY user-portal/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/user-portal/dist /usr/share/nginx/html
EXPOSE 80
