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

这是一个基于 **Nx** 的 monorepo，用于构建分布式 AI Agent 系统。

- **根目录**: `/Volumes/code/agency`
- **包管理器**: pnpm
- **构建工具**: Nx

## 项目结构

```
apps/
├── server/              # WebRTC 信令服务器
│   ├── 提供信令服务      # Signaling for WebRTC
│   ├── STUN 服务        # NAT 穿透
│   └── TURN 服务        # 中继转发
├── host/                # 本地 Agent 运行时
│   ├── 通过 AgentClientProtocol 管理 Agent
│   ├── 本地执行 Agent 任务
│   └── 支持多实例运行    # 可同时运行多个 host
├── host-e2e/            # host 的 E2E 测试
├── client/              # Web GUI 前端
│   ├── 基于 Modern.js + React
│   ├── 使用 shadcn/ui 组件库
│   └── 通过 WebRTC 与 host 通信
└── server-e2e/          # server 的 E2E 测试
```

### Server

WebRTC 基础设施服务器：
- **信令服务**: 协调 WebRTC 连接建立
- **STUN 服务**: 获取公网地址，实现 NAT 穿透
- **TURN 服务**: 在直连失败时提供中继转发

### Host

本地 Agent 运行时：
- 通过 **AgentClientProtocol** 实现 Agent 的管理和运行
- 每个 host 是独立运行的本地进程
- **支持多 host 架构**: 一个 client 可以同时连接多个 host
- 负责实际执行 Agent 任务，与本地资源交互

### Client

Web GUI 前端应用：
- **框架**: Modern.js 3.x + React 19
- **UI 组件**: shadcn/ui 组件库，位于 `src/components/ui/`
- **表单处理**: React Hook Form + Zod (用于表单验证)
- **表单组件**: shadcn/ui Field 组件 (Form, FormField, FormItem, FormLabel, FormControl, FormMessage)
- **通信方式**: 通过 WebRTC 与 host 建立 P2P 连接
- **多 host 管理**: 可以同时连接和管理多个 host 实例

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
┌─────────────────┐      WebRTC      ┌─────────────────┐
│     Client      │ ◄──────────────► │   Host (本地)    │
│   (Web GUI)     │                  │  (Agent 运行时)  │
└────────┬────────┘                  └─────────────────┘
         │                           ┌─────────────────┐
         │      WebRTC               │   Host (本地)    │
         └─────────────────────────► │  (Agent 运行时)  │
                                     └─────────────────┘
         ▲
         │ Signaling / STUN / TURN
         ▼
┌─────────────────┐
│  Server (信令)   │
└─────────────────┘
```

- **Client** 和 **Host** 之间通过 WebRTC 进行 P2P 通信
- **Server** 提供 WebRTC 连接所需的信令、STUN、TURN 服务
- 支持 **一对多** 连接: 一个 client 可以连接多个 host

## 常用命令

```bash
# 开发
npx nx serve server          # 启动信令服务器
npx nx serve host            # 启动 host
npx nx serve client          # 启动前端开发服务器

# 构建
npx nx build server          # 构建 server
npx nx build host            # 构建 host
npx nx build client          # 构建 client

# 测试
npx nx test server           # 运行 server 单元测试
npx nx test host             # 运行 host 单元测试
npx nx test server-e2e       # 运行 server E2E 测试
npx nx test host-e2e         # 运行 host E2E 测试

# 代码检查
npx biome check .            # 检查代码
npx biome check --write .    # 自动修复问题

# 查看项目信息
npx nx show project server   # 查看 server 项目详情
npx nx show project host     # 查看 host 项目详情
npx nx show project client   # 查看 client 项目详情
npx nx graph                 # 可视化项目依赖图
```

## 注意事项

1. **不要修改 test 文件**: 除非明确要求，否则不要修改测试文件
2. **最小化变更**: 遵循最小化原则，只做必要的修改
3. **pnpm workspace**: 前端应用在 `apps/*` 目录下有自己的 package.json
4. **Never connect to Nx Cloud**: `neverConnectToCloud: true` 已设置
5. **Node.js 内置模块导入**: Node.js 内置模块（如 `fs`, `path`, `crypto` 等）必须使用 `node:` 前缀导入，例如 `import fs from 'node:fs'`

<!-- project description end-->
