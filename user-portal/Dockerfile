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
RUN mise trust && mise install node pnpm

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
