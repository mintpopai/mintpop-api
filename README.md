# MintPop API

MintPop API 是一个 **AI API 网关服务**：把上游 AI 订阅（Claude / OpenAI / Gemini 等）的额度，通过平台签发的 API Key 二次分发给用户，并负责鉴权、计费、负载均衡、并发限流与请求转发。

技术栈：Go（Gin + Ent + Wire）后端 + Vue3 前端，数据库 PostgreSQL + Redis。前端构建产物通过 Go `embed` 打进单二进制。

## 快速部署（Docker Compose）

仅支持 Docker 部署，编排两个镜像：`mintpop-api-backend`（后端，内嵌 admin 前端）与 `mintpop-api-user-portal`（用户门户）。PostgreSQL 与 Redis 为外部独立服务，通过 `.env` 配置。

```bash
# 1. 准备环境变量（配置 OWNER、数据库、Redis 等）
cp .env.example .env

# 2. 准备后端配置
mkdir -p data && cp backend/config.example.yaml data/config.yaml

# 3. 拉取镜像并启动
docker compose up -d        # 或：mise run up
```

服务端口默认仅绑定 `127.0.0.1`（后端 `9200`、用户门户 `9201`），需自备反向代理对外暴露。详细路由约定见 `docker-compose.yml` 顶部注释。

## 开发

工具链与命令统一收口到 `mise`（见 `mise.toml`），常用命令：

```bash
mise run install       # 安装全部组件依赖
mise run build-backend # 编译后端单二进制（内嵌前端）
mise run test-backend / test-frontend / test-user-portal
```

更多开发说明见 `CLAUDE.md`。

## 声明

- 使用本项目可能违反 Anthropic 等上游服务商的服务条款，请在使用前自行阅读相关协议，由此产生的风险由使用者自行承担。
- 本项目仅供技术学习与研究使用，请在所在国家/地区法律法规允许的范围内使用。

## 许可与致谢

本项目基于 [Wei-Shaw/sub2api](https://github.com/Wei-Shaw/sub2api) 二次开发，许可证遵循根目录 `LICENSE` 文件。
