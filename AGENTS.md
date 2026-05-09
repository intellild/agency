<!-- nx configuration start-->
<!-- Leave the start & end comments to automatically receive updates. -->

# General Guidelines for working with Nx

- For navigating/exploring the workspace, invoke the `nx-workspace` skill first - it has patterns for querying projects, targets, and dependencies
- When running tasks (for example build, lint, test, e2e, etc.), always prefer running the task through `nx` (i.e. `nx run`, `nx run-many`, `nx affected`) instead of using the underlying tooling directly
- Prefix nx commands with the workspace's package manager (e.g., `pnpm nx build`, `npm exec nx test`) - avoids using globally installed CLI
- You have access to the Nx MCP server and its tools, use them to help the user
- For Nx plugin best practices, check `node_modules/@nx/<plugin>/PLUGIN.md`. Not all plugins have this file - proceed without it if unavailable.
- NEVER guess CLI flags - always check nx_docs or `--help` first when unsure

## Scaffolding & Generators

- For scaffolding tasks (creating apps, libs, project structure, setup), ALWAYS invoke the `nx-generate` skill FIRST before exploring or calling MCP tools

## When to use nx_docs

- USE for: advanced config options, unfamiliar flags, migration guides, plugin configuration, edge cases
- DON'T USE for: basic generator syntax (`nx g @nx/react:app`), standard commands, things you already know
- The `nx-generate` skill handles generator discovery internally - don't call nx_docs just to look up generator syntax


<!-- nx configuration end-->

<!-- project description start-->

# AGENTS.md - Agency Monorepo

> AI 代理工作指南

## 项目概览

这是一个基于 **Nx** 的 monorepo，用于构建分布式 AI Agent 管理系统。

- **根目录**: `/data00/home/jinzhixin/agency`
- **包管理器**: pnpm
- **构建工具**: Nx
- **HTTP 服务端**: Hono
- **P2P 通信**: libp2p circuit relay
- **Agent 管理协议**: Agent Client Protocol (ACP)

## 项目结构

```
apps/
├── server/              # Hono API + OAuth + libp2p relay
│   ├── GitHub OAuth 登录
│   ├── 读取 ~/.agency/config.json
│   ├── libp2p circuit relay
│   └── client/host peer registry
├── host/                # 本地 Agent 运行时
│   ├── 通过 Agent Client Protocol 管理 Agent
│   ├── 本地执行 Agent 任务
│   ├── 连接 server relay
│   └── 注册为 host
├── client/              # Web GUI 前端
│   ├── 基于 Modern.js + React
│   ├── 使用 shadcn/ui 组件库
│   ├── 只填写 server 地址登录
│   └── 通过 libp2p 与 host 建立 ACP 会话
└── libs/common/         # 共享类型和协议常量
```

### Server

Hono HTTP API 和 libp2p relay：

- **GitHub OAuth**: client 打开 `SERVER/oauth/github`，server 跳转 GitHub 并处理 callback
- **配置文件**: 启动时读取 `~/.agency/config.json`，不存在时自动创建
- **白名单**: 登录时检查 GitHub username 是否在 `github.whitelist` 中；空数组表示不限制
- **认证**: server 签发 access token 和 refresh token
- **relay**: server 作为 libp2p circuit relay 节点
- **peer registry**: 记录连接节点，区分 `client` 和 `host`
- **实时更新**: 通过 `GET /api/p2p/events` 提供 SSE peer 事件流

#### `~/.agency/config.json`

```json
{
  "auth": {
    "jwtSecret": "replace-with-a-long-random-secret"
  },
  "github": {
    "clientId": "your_github_oauth_client_id",
    "clientSecret": "your_github_oauth_client_secret",
    "whitelist": ["your-github-login"]
  },
  "libp2p": {
    "wsPort": 9090,
    "publicAddresses": []
  }
}
```

- 开发模式下，server 暴露给 client 的 libp2p 地址只应包含 `127.0.0.1`
- 生产模式下，server 使用 `libp2p.publicAddresses` 暴露部署后的可访问地址
- GitHub OAuth callback URL 应配置为 `SERVER/oauth/github/callback`

### Host

本地 Agent 运行时：

- 通过 **Agent Client Protocol** 实现 Agent 的管理和运行
- 每个 host 是独立运行的本地进程
- **支持多 host 架构**: 一个 client 可以同时连接多个 host
- 通过 `GET /api/p2p/config` 获取 server relay 地址
- 连接 server relay 后，通过 `POST /api/p2p/peers` 注册为 `host`
- 定期刷新注册信息，退出时注销
- 暴露 libp2p 协议 `/agency/acp/1.0.0`

### Client

Web GUI 前端应用：

- **框架**: Modern.js 3.x + React 19
- **UI 组件**: shadcn/ui 组件库，位于 `src/components/ui/`
- **表单处理**: React Hook Form + Zod (用于表单验证)
- **表单组件**: shadcn/ui Field 组件 (Form, FormField, FormItem, FormLabel, FormControl, FormMessage)
- **登录方式**: 只填写 server 地址；GitHub client id 只存储在 server 配置中
- **通信方式**: 通过 libp2p relay 与 host 建立 P2P 连接
- **多 host 管理**: 可以同时连接和管理多个 host 实例
- **实时 host 列表**: 通过 SSE 订阅 server peer registry 更新
- **ACP 会话**: 连接 host 后通过 `/agency/acp/1.0.0` 完成 ACP `initialize` / `newSession`

#### Client 路径别名 (tsconfig paths)

```json
{
  "@/*": ["./src/*"],
  "@shared/*": ["./shared/*"]
}
```

- `@/components/ui` → `src/components/ui`
- `@/utils` → `src/utils`
- `@shared/*` → `shared/*`

## 架构关系

```
┌─────────────────┐
│     Client      │
│   Modern.js UI  │
└────────┬────────┘
         │ HTTP OAuth / API / SSE
         ▼
┌─────────────────┐
│     Server      │
│ Hono + libp2p   │
│ circuit relay   │
└────────┬────────┘
         │ libp2p relay
         ▼
┌─────────────────┐      ACP over libp2p      ┌─────────────────┐
│     Client      │ ◄────────────────────────► │   Host (本地)    │
│   P2P node      │                            │  Agent runtime   │
└─────────────────┘                            └─────────────────┘
```

- **Client** 和 **Host** 之间通过 libp2p 建立连接
- **Server** 只作为 OAuth/API/SSE 服务和 circuit relay 节点，不承载 ACP 会话
- 支持 **一对多** 连接: 一个 client 可以连接多个 host

## 常用命令

```bash
# 开发
pnpm nx serve server         # 启动 Hono API + libp2p relay
pnpm nx serve client         # 启动前端开发服务器

# host 需要登录后得到的 access token
AGENCY_SERVER_URL=http://localhost:3000 \
AGENCY_ACCESS_TOKEN=<access-token> \
pnpm nx serve host

# 构建
pnpm nx build server
pnpm nx build @agency/host
pnpm nx build client

# 测试
pnpm nx test server
pnpm nx test @agency/host

# 代码检查
pnpm biome check .
pnpm biome check --write <file-path>

# 查看项目信息
pnpm nx show project server
pnpm nx show project @agency/host
pnpm nx show project client
pnpm nx graph
```

## 注意事项

1. **不要修改 test 文件**: 除非明确要求，否则不要修改测试文件
2. **最小化变更**: 遵循最小化原则，只做必要的修改
3. **代码检查与格式化**: 修改文件后，使用 `pnpm biome check --write <file-path>` 检查并格式化代码
4. **pnpm workspace**: 前端应用在 `apps/*` 目录下有自己的 package.json
5. **根目录安装依赖**: 共用依赖安装到项目根目录，在根目录使用 `pnpm add -w <package>` 命令（`-w` 表示 workspace root）
6. **Never connect to Nx Cloud**: `neverConnectToCloud: true` 已设置
7. **Node.js 内置模块导入**: Node.js 内置模块（如 `fs`, `path`, `crypto` 等）必须使用 `node:` 前缀导入，例如 `import fs from 'node:fs'`
8. **不要重新引入 Express**: server 使用 Hono；新增 HTTP route 应直接注册到 Hono app 或拆成 Hono route 模块
9. **不要在 client 保存 GitHub Client ID**: GitHub OAuth client id/secret 只属于 server config
10. **libp2p 协议常量**: ACP over libp2p 使用 `/agency/acp/1.0.0`

<!-- project description end-->
