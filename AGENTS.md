# AGENTS.md - Agency Monorepo

> AI 代理工作指南 - Spec Driven Development 工作流

## 项目概览

这是一个基于 **Nx** 的 monorepo，采用 **Spec Driven Development** 方法论进行开发。

- **根目录**: `/Volumes/code/agency-specs/agency`
- **包管理器**: pnpm
- **构建工具**: Nx
- **开发框架**: Fastify (后端) + Modern.js (前端)

## 项目结构

```
agency/
├── apps/
│   ├── agency/          # Fastify 后端应用
│   ├── agency-e2e/      # E2E 测试
│   └── client/          # Modern.js + React 前端应用
├── nx.json              # Nx 配置
├── biome.json           # 代码规范配置
├── tsconfig.base.json   # TypeScript 基础配置
└── package.json         # 根包配置
```

## 技术栈

### 后端 (`apps/agency`)
- **运行时**: Node.js 20+
- **框架**: Fastify 5.2
- **语言**: TypeScript 5.9
- **模块**: ESM (NodeNext)
- **测试**: Jest

### 前端 (`apps/client`)
- **框架**: Modern.js 3.1
- **UI 库**: React 19
- **构建工具**: Rspack
- **代码规范**: Biome

### 代码质量工具
- **Linter/Formatter**: Biome
- **类型检查**: TypeScript (严格模式)
- **测试**: Jest + @swc/jest

## 常用命令

```bash
# 开发
npx nx serve agency          # 启动后端服务
npx nx serve client          # 启动前端开发服务器 (cd apps/client && pnpm dev)

# 构建
npx nx build agency          # 构建后端
npx nx build client          # 构建前端

# 测试
npx nx test agency           # 运行后端单元测试
npx nx test agency-e2e       # 运行 E2E 测试

# 代码检查
npx biome check .            # 检查代码
npx biome check --write .    # 自动修复问题

# 查看项目信息
npx nx show project agency   # 查看 agency 项目的所有目标
npx nx graph                 # 可视化项目依赖图
```

## 开发工作流

### Spec Driven Development

本仓库配合 `openspec/` 目录使用 Spec Driven Development 流程：

1. **变更提案**: 在 `openspec/changes/` 中创建新的变更提案
2. **设计评审**: 评审通过后，生成设计文档和任务列表
3. **实现**: 按照任务列表进行开发
4. **归档**: 完成后变更会被归档到 `openspec/changes/archive/`

参考项目根目录的 `.claude/skills/` 中的 skills 了解详细流程。

### 添加新应用

```bash
# Node.js 应用
npx nx g @nx/node:app <app-name>

# Node.js 库
npx nx g @nx/node:lib <lib-name>
```

## 代码规范

### TypeScript 配置
- `target`: ES2022
- `module`: NodeNext
- `strict`: true (启用所有严格类型检查)
- `isolatedModules`: true
- `noUnusedLocals`: true
- `noImplicitReturns`: true

### 代码风格 (Biome)
- 缩进: 2 个空格
- 引号: 单引号 (JS/TS), 双引号 (JSX)
- 行宽: 80 字符
- 箭头函数括号: 按需使用

## 项目依赖

### 核心依赖
- `fastify` - Web 框架
- `@fastify/autoload` - 自动加载插件
- `@fastify/sensible` - 实用工具

### 开发依赖
- `nx` - Monorepo 构建系统
- `@nx/node`, `@nx/js`, `@nx/jest` - Nx 插件
- `@swc/core`, `@swc/jest` - 快速编译和测试
- `typescript` - 类型系统
- `biome` - 代码规范

## 注意事项

1. **不要修改 test 文件**: 除非明确要求，否则不要修改测试文件
2. **最小化变更**: 遵循最小化原则，只做必要的修改
3. **pnpm workspace**: 前端应用在 `apps/*` 目录下有自己的 package.json
4. **Never connect to Nx Cloud**: `neverConnectToCloud: true` 已设置

## 相关目录

- `/Volumes/code/agency-specs/openspec/` - Spec Driven Development 配置
- `/Volumes/code/agency-specs/.claude/skills/` - OpenSpec Skills
