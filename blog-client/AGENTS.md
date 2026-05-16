# Vite Plus 完全指南

## 📌 什么是 Vite Plus?

**Vite Plus** (简称 **Vite+**) 是一个统一的前端工具链和开发入口点。它整合了现代 Web 开发所需的所有工具，包括：

- **Vite** - 快速的开发服务器和应用构建工具
- **Rolldown** - 高性能的应用级别打包器
- **Vitest** - Vite 原生的单元测试运行器
- **Oxlint** - 基于 Rust 的超高速 linter（ESLint 的 10-100 倍速）
- **Oxfmt** - Prettier 兼容的代码格式化工具
- **tsdown** - 库和独立可执行文件的打包工具
- **Vite Task** - 任务编排和缓存系统

## 🎯 解决的核心问题

JavaScript 生态系统存在以下问题：

1. **工具碎片化** - 需要组装多个工具（Node.js、包管理器、linter、formatter、test runner 等）
2. **配置复杂** - 多个配置文件散布在项目中
3. **性能低下** - 工具运行缓慢，尤其是在大型项目中
4. **不一致性** - 团队间使用不同的工具栈导致维护困难

Vite Plus 通过统一工具链解决这些问题，提供一致的开发体验。

## 🚀 核心设计理念

1. **Rust 驱动高性能** - 使用 Rust 实现关键工具，速度提升 10-100 倍
2. **单一配置文件** - 所有配置集中在 `vite.config.ts`
3. **开箱即用** - 无需复杂的手动配置
4. **生态兼容** - 支持 React、Vue、Svelte 等所有主流框架
5. **包管理器灵活** - 支持 pnpm、npm、yarn、bun

## 📦 两个核心组件

### 1. `vp` - 全局命令行工具

安装一次，全局使用。管理 Node.js 运行时和项目依赖。

**安装方式：**

```bash
# macOS / Linux
curl -fsSL https://vite.plus | bash

# Windows
irm https://vite.plus/ps1 | iex
```

### 2. `vite-plus` - 本地项目包

每个项目的 devDependency，提供项目级别的配置和工具集成。

## 🛠️ 核心命令速查表

### 项目启动

| 命令         | 功能                         |
| ------------ | ---------------------------- |
| `vp create`  | 创建新项目、单体仓库或库     |
| `vp install` | 安装依赖（自动检测包管理器） |
| `vp migrate` | 将现有 Vite 项目迁移到 Vite+ |

### 开发

| 命令       | 功能                                 |
| ---------- | ------------------------------------ |
| `vp dev`   | 启动开发服务器（基于 Vite）          |
| `vp check` | 格式化 + lint + 类型检查（单一命令） |
| `vp lint`  | 仅运行 Oxlint 代码检查               |
| `vp fmt`   | 仅运行 Oxfmt 格式化                  |
| `vp test`  | 运行 Vitest 测试                     |

### 构建

| 命令         | 功能                                |
| ------------ | ----------------------------------- |
| `vp build`   | 构建应用（用于 Web 项目）           |
| `vp pack`    | 打包库或独立可执行文件（用 tsdown） |
| `vp preview` | 本地预览生产构建                    |

### 任务与执行

| 命令             | 功能                                             |
| ---------------- | ------------------------------------------------ |
| `vp run <task>`  | 运行 package.json 脚本或 vite.config.ts 中的任务 |
| `vpr <task>`     | `vp run` 的快捷方式                              |
| `vp cache clean` | 清除任务缓存                                     |
| `vpx <pkg>`      | 下载并运行全局二进制包                           |
| `vp exec <cmd>`  | 运行项目本地的二进制                             |
| `vp dlx <pkg>`   | 一次性运行包，不添加到依赖                       |

### 依赖管理

| 命令              | 功能                   |
| ----------------- | ---------------------- |
| `vp add <pkg>`    | 添加依赖               |
| `vp remove <pkg>` | 移除依赖               |
| `vp update`       | 更新依赖               |
| `vp outdated`     | 显示过时的依赖         |
| `vp why <pkg>`    | 解释为什么安装了某个包 |
| `vp list`         | 列出已安装的包         |

### 环境管理

| 命令                       | 功能                                    |
| -------------------------- | --------------------------------------- |
| `vp env on`                | 启用 Vite+ 管理 Node.js 版本（推荐）    |
| `vp env off`               | 使用系统 Node.js 优先                   |
| `vp env pin <version>`     | 锁定项目 Node.js 版本到 `.node-version` |
| `vp env default <version>` | 设置全局默认 Node.js 版本               |

### 维护

| 命令         | 功能               |
| ------------ | ------------------ |
| `vp upgrade` | 更新 `vp` 工具本身 |
| `vp implode` | 卸载 Vite+         |

## 📝 配置文件结构

Vite+ 使用单一的 `vite.config.ts` 文件进行所有配置：

```typescript
import { defineConfig } from "vite-plus";

export default defineConfig({
  // Vite 标准配置
  server: { port: 5173 },
  build: { outDir: "dist" },
  preview: {},

  // Vite+ 扩展配置
  test: {
    include: ["src/**/*.test.ts"],
  },

  lint: {
    ignorePatterns: ["dist/**"],
    options: {
      typeAware: true, // 启用类型感知规则
      typeCheck: true, // 启用完整类型检查
    },
  },

  fmt: {
    singleQuote: true, // Prettier 兼容配置
    semi: false,
  },

  run: {
    cache: {
      tasks: true, // 默认缓存任务
      scripts: false, // 默认不缓存脚本
    },
    tasks: {
      build: {
        command: "vp build",
        dependsOn: ["lint"], // 任务依赖
        env: ["NODE_ENV"], // 影响缓存的环境变量
      },
    },
  },

  pack: {
    dts: true, // 生成 TypeScript 声明文件
    format: ["esm", "cjs"], // 输出格式
  },

  staged: {
    "*": "vp check --fix", // 提交前检查钩子
  },
});
```

## 🎯 关键特性详解

### 1. 统一的 `vp check` 命令

传统方式需要三个独立命令：

```bash
npm run fmt
npm run lint
npm run type-check
```

Vite+ 统合为一个快速命令：

```bash
vp check
vp check --fix              # 自动修复
vp check --no-fmt           # 跳过格式化
vp check --no-lint          # 跳过 lint
vp check --no-fmt --no-lint # 仅类型检查
```

性能提升：由于使用 Rust 工具和优化的管道，`vp check` 比分别运行快 **2 倍**。

### 2. 任务缓存系统

Vite Task 自动追踪文件变更，缓存任务输出：

```bash
vp run --cache build  # 首次运行，执行任务
# 如果代码未改变
vp run --cache build  # ✓ 缓存命中，瞬间完成
```

**缓存命中时的信息：**

```
$ vp build ✓ cache hit, replaying
✓ built in 28ms

---
vp run: cache hit, 28s saved.
```

**智能缓存追踪：**

- 自动检测所有读取的文件
- 追踪缺失文件（创建后自动失效）
- 追踪目录列表（添加/删除文件后失效）
- 可配置环境变量影响缓存

### 3. 任务依赖和编排

定义复杂的任务流程：

```typescript
run: {
  tasks: {
    lint: { command: 'vp lint' },
    test: { command: 'vp test' },
    build: {
      command: 'vp build',
      dependsOn: ['lint', 'test'],  // 必须先 lint 和 test
    },
    deploy: {
      command: 'deploy-script',
      dependsOn: ['build'],
      cache: false,  // 部署不缓存
    },
  },
}
```

运行时自动按依赖顺序执行。

### 4. 单体仓库（Monorepo）支持

在单体仓库中运行任务：

```bash
# 当前包中运行
vp run build

# 所有包递归运行
vp run -r build

# 特定包运行
vp run @my/app#build

# 包及其依赖运行
vp run -t @my/app#build

# 过滤包
vp run --filter "@my/*" build
vp run --filter "!@my/utils" build

# 并发控制
vp run -r build --concurrency-limit 8
vp run -r --parallel build  # 忽略依赖关系
```

### 5. 类型感知 Linting

启用类型感知规则获得更智能的检查：

```typescript
lint: {
  options: {
    typeAware: true,  // 需要 TypeScript 类型信息的规则
    typeCheck: true,  // 完整类型检查
  },
}
```

由 tsgolint（TypeScript Go 工具链）驱动，性能出众。

### 6. Staged 文件 Hooks

在 Git 提交前自动检查修改的文件：

```typescript
staged: {
  '*': 'vp check --fix',  // 对所有文件运行检查
}
```

运行 `vp config` 自动设置 Git 钩子。

## 📊 Vite Plus vs 传统工具链

### 传统方式

```bash
npm install       # 安装依赖
npm run dev       # 启动开发
npm run lint      # 检查 1
npm run fmt       # 检查 2
npm run type-check # 检查 3
npm run test      # 测试
npm run build     # 构建
```

配置文件：`vite.config.ts`, `.eslintrc`, `.prettierrc`, `vitest.config.ts`, `tsconfig.json`

### Vite Plus 方式

```bash
vp install        # 安装依赖
vp dev           # 启动开发
vp check         # 全部检查（1+2+3）
vp test          # 测试
vp build         # 构建
```

配置文件：仅 `vite.config.ts` ✨

## 🌍 包管理器自动检测

Vite+ 按此顺序自动检测包管理器：

1. `package.json` 中的 `packageManager`
2. `pnpm-workspace.yaml`
3. `pnpm-lock.yaml`
4. `yarn.lock` 或 `.yarnrc.yml`
5. `package-lock.json`
6. `bun.lock` 或 `bun.lockb`
7. `.pnpmfile.cjs` 或 `pnpmfile.cjs`
8. `bunfig.toml`
9. `yarn.config.cjs`

如果都没找到，默认使用 **pnpm**。自动下载匹配的包管理器版本。

## 🔧 Node.js 版本管理

Vite+ 自动管理 Node.js 版本（默认启用）：

```bash
vp env on                # 启用管理模式（推荐）
vp env off               # 禁用，使用系统 Node.js

vp env pin lts           # 锁定项目到最新 LTS
vp env default lts       # 设置全局默认版本
vp env install           # 安装 .node-version 中的版本

vp env list              # 列出本地版本
vp env list-remote --lts # 列出远程版本
```

项目版本锁定在 `.node-version` 文件中。

## 📚 主要的 Vite Plus 工具详解

### Oxlint - 极速 Linter

- **速度：** 比 ESLint 快 10-100 倍
- **兼容性：** 支持大多数核心 ESLint 规则和社区规则
- **类型感知：** 支持 TypeScript 类型检查规则
- **配置：** 在 `vite.config.ts` 的 `lint` 块

```typescript
lint: {
  ignorePatterns: ['dist/**', 'node_modules/**'],
  options: {
    typeAware: true,
    typeCheck: true,
  },
}
```

### Oxfmt - Prettier 兼容格式化工具

- **速度：** 比 Prettier 快得多
- **兼容性：** 100% Prettier 配置兼容
- **配置：** 在 `vite.config.ts` 的 `fmt` 块

```typescript
fmt: {
  singleQuote: true,
  semi: false,
  trailingComma: 'es5',
}
```

### Vitest - Vite 原生测试框架

- **快速：** 基于 Vite 的开发体验
- **兼容：** Jest 风格的 API
- **特性：** 快照、覆盖率、TypeScript 支持
- **配置：** 在 `vite.config.ts` 的 `test` 块

```typescript
test: {
  include: ['src/**/*.test.ts'],
  coverage: {
    provider: 'v8',
    reporter: ['text', 'json', 'html'],
  },
}
```

### tsdown - 库打包工具

用于打包库和独立可执行文件：

```bash
vp pack                      # 打包库
vp pack --watch              # 监视模式
vp pack --dts                # 生成类型声明
```

支持多个输出格式（ESM、CommonJS）、source maps 和压缩。

### Vite Task - 任务编排系统

- **缓存：** 智能任务输出缓存
- **依赖：** 任务依赖关系管理
- **单体仓库：** 跨包执行和过滤
- **并发：** 可配置的并发执行

## 🎓 最佳实践

### 1. 使用类型感知检查

总是启用 `typeAware` 和 `typeCheck`：

```typescript
lint: {
  options: {
    typeAware: true,
    typeCheck: true,
  },
}
```

### 2. 一个配置文件统治一切

将所有工具配置放在 `vite.config.ts`，不要分散在多个文件中。

### 3. 启用 Staged 检查

自动在提交前检查修改的文件：

```typescript
staged: {
  '*': 'vp check --fix',
}
```

### 4. 定义任务依赖

在复杂项目中明确定义任务依赖：

```typescript
run: {
  tasks: {
    build: {
      command: 'vp build',
      dependsOn: ['lint', 'test'],
    },
  },
}
```

### 5. 启用任务缓存

对于昂贵的操作启用缓存：

```bash
vp run --cache build  # 首次执行
vp run --cache build  # 文件未改，缓存命中！
```

### 6. Pin Node.js 版本

对于团队协作，锁定 Node.js 版本：

```bash
vp env pin lts
# 生成 .node-version 文件
```

## 🔄 从现有 Vite 项目迁移

如果已有 Vite 项目，可以轻松迁移：

```bash
vp migrate
```

或者告诉 AI 编程助手使用迁移提示。迁移后：

- 所有工具配置移到 `vite.config.ts`
- 自动设置 Oxlint、Oxfmt、Vitest
- 启用类型检查和 staged 钩子

## 📖 本项目（blog-client）的配置

当前项目使用以下配置：

```typescript
import { defineConfig } from "vite-plus";

export default defineConfig({
  staged: {
    "*": "vp check --fix", // 提交前自动检查和修复
  },
  fmt: {}, // 使用默认格式化配置
  lint: {
    options: {
      typeAware: true,
      typeCheck: true,
    },
  }, // 启用类型感知检查
});
```

**使用的命令：**

```bash
vp dev              # 启动开发服务器
vp build            # 构建应用
vp preview          # 预览生产版本
vp check            # 检查代码（格式 + lint + 类型）
vp check --fix      # 自动修复
vp test             # 运行测试
vp install          # 安装依赖
```

## 🎯 快速参考

### 日常开发流程

```bash
vp dev              # 启动开发
# 编辑代码...
vp check            # 在提交前检查（或自动通过 staged 钩子）
git commit          # 提交（自动运行 vp check --fix）
```

### 发布流程

```bash
vp check            # 确保所有检查通过
vp test             # 确保测试通过
vp build            # 构建生产版本
vp preview          # 预览构建结果
# 部署...
```

### 团队管理

```bash
vp env pin lts      # 锁定 Node.js 版本
git add .node-version package.json
vp install          # 其他团队成员运行
# 所有人现在用同一版本！
```

## 🌟 Vite Plus 的优势总结

✨ **性能** - Rust 工具链提供 10-100 倍的速度提升
📦 **统一** - 单一配置文件管理所有工具
⚡ **快速** - 开箱即用，无需复杂配置
🔒 **可靠** - 任务缓存和依赖管理保证一致性
🛠️ **灵活** - 支持所有主流框架和包管理器
🎯 **智能** - 类型感知检查和自动文件追踪
🤝 **团队友好** - Node.js 版本管理简化协作

---

**文档版本：** Vite Plus v0.1.20  
**最后更新：** 2024
