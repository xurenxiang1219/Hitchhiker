# Hitchhiker 本地开发启动指引

本文档说明如何在本地启动后端 API 与前端客户端（本地分离开发模式），并给出常见问题处理方法。

## 前置依赖
- Node.js: 推荐 v20.18.x（前端 Webpack4 需要启用 OpenSSL 旧提供器），或使用 v16 构建 DLL 更稳妥
- yarn: 1.x
- Docker + Docker Compose（用于 MariaDB）

## 数据库（MariaDB via Docker）
项目已提供多份 compose 文件，可选其一：
- `deploy/docker/mysql/docker-compose.yml`（仅数据库）
- `deploy/docker/hitchhiker_and_mysql/docker-compose.yml`（包含服务组合）

建议仅启动数据库：
```bash
# 在项目根目录执行（示例：仅 DB）
docker compose -f deploy/docker/mysql/docker-compose.yml up -d
```
启动后，确认数据库端口与账号密码配置与后端一致。

## 后端（API）启动
后端源码目录：`api/`
- 入口文件：`api/src/index.ts`，监听端口由 `Setting.instance.appPort` 决定
- TypeORM 自动建表和模式日志已禁用（`src/services/connection_manager.ts` 中）

首次安装依赖并构建：
```bash
# 在 api/
yarn install
# 编译 TS 并复制本地化资源到 build/
yarn build
```
启动服务（Node 直接运行编译输出）：
```bash
# 在 api/
node build/index.js
```
若需要修改数据库或服务端口，请查看：
- `api/src/utils/setting.ts`
- `api/src/services/connection_manager.ts`

日志配置：
- log4js 配置文件：`api/logconfig.json`
- 日志工具：`api/src/utils/log.ts`

## 前端（Client）启动
前端源码目录：`client/`

安装依赖：
```bash
# 在 client/
yarn install
```
生成 DLL（首次或依赖变更时执行，以生成 `build/static/js/*.manifest.json`）：
```bash
# Node 20 下需启用 OpenSSL 旧提供器
# package.json 已提供脚本：
yarn build:dll
```
启动开发服务器：
```bash
# 常规启动（如 Node 20 下报 OpenSSL 错误则用下一条）
yarn start
# Node 20 备用：启用旧提供器
yarn run start:legacy
```

说明：
- Webpack 开发配置：`client/config/webpack.config.dev.js`
- DLL 开发配置：`client/config/webpack_dll.config.dev.js`
- 已在 `client/package.json` 添加脚本：
  - `build:dll`: `NODE_OPTIONS=--openssl-legacy-provider webpack --config config/webpack_dll.config.dev.js`
  - `start:legacy`: `NODE_OPTIONS=--openssl-legacy-provider node scripts/start.js`

## 常见问题排查
- 找不到 DLL manifest（如 `react.manifest.json`）：需先执行 `yarn build:dll`。
- Node 20 下 OpenSSL 报错（`ERR_OSSL_EVP_UNSUPPORTED`）：使用 `yarn build:dll` 与 `yarn run start:legacy`。
- TypeScript 类型缺失（例如 `TS2688: minimatch`）：
  - 已在 `client/typePatches/index.d.ts` 兜底；如仍报错，安装 `@types/minimatch@3.0.3`（项目已添加）。

## 启动顺序建议
1. 启动 MariaDB 容器。
2. 启动后端：`api/` 执行 `yarn build && node build/index.js`。
3. 启动前端：`client/` 执行 `yarn build:dll`（若首次）与 `yarn start`（或 `yarn run start:legacy`）。

## 端口与访问
- 后端默认端口：在 `api/src/utils/setting.ts` 的 `Setting.instance.appPort`（示例常见为 81/9527）。
- 前端开发服务器：默认 `http://localhost:3000/`（如在 `client/package.json` 配置 `proxy` 指向后端 `http://localhost:81`）。

如需进一步 CI/CD 或容器一体化启动，可使用 `deploy/docker/hitchhiker_and_mysql/docker-compose.yml` 并按需调整。
