<div align="center">

<img src="https://github.com/user-attachments/assets/7cb43959-bb66-4dda-a0ab-f6706412ba72" alt="Pi VSCode Logo" width="120" height="120">

# Pi Agent Studio

**面向 [pi coding agent](https://pi.dev/) 的功能丰富的 VS Code 扩展 -- 原生终端 TUI 或 webview 聊天面板、完整编辑器桥接，开箱即用内置 pi 扩展（todo / subagent ...），并配套会话侧边栏与涵盖模型、Agents、设置等的完整设置面板** 🔥

[English](README.md) | 简体中文

</div>

[![VS Code Marketplace](https://img.shields.io/visual-studio-marketplace/v/johnny-zhao.pi-agent-studio?label=VS%20Code%20Marketplace&color=blue)](https://marketplace.visualstudio.com/items?itemName=johnny-zhao.pi-agent-studio)
[![Open VSX](https://img.shields.io/open-vsx/v/johnny-zhao/pi-agent-studio?label=Open%20VSX&color=purple)](https://open-vsx.org/extension/johnny-zhao/pi-agent-studio)
[![License](https://img.shields.io/github/license/JohnnyZ93/pi-agent-studio?color=orange&label=License)](https://github.com/JohnnyZ93/pi-agent-studio/blob/main/LICENSE)
[![Stars](https://img.shields.io/github/stars/JohnnyZ93/pi-agent-studio?style=social)](https://github.com/JohnnyZ93/pi-agent-studio)

## 特性

- **原生终端 TUI** -- Pi 运行在 VS Code 集成终端（PTY）中。无 shell 层、无引号黑魔法--pi 二进制直接启动（默认模式）
- **Webview 聊天面板** -- 可选的 `webview` 模式，由 `pi --mode rpc` 子进程驱动的流式聊天面板，支持提示排队（Enter 转向 / Alt+Enter 追加）、输入历史、Fork/Revert、内置命令与重试
- **模型品牌图标** —— 聊天面板在 composer 模型下拉框旁和消息时间戳的模型名前显示圆形品牌头像（OpenAI、Claude、Gemini、DeepSeek、Qwen、Grok …），按模型 id 前缀匹配（覆盖 30+ 厂商）
- **Mermaid 与数学公式渲染** —— webview 聊天面板将 `mermaid` 代码块渲染为交互式图表，并用 KaTeX 渲染数学公式（`$...$`、`$$...$$`）；图表主题可通过 `pi-agent-studio.chatMermaidTheme` 配置（`default` / `neutral` / `dark` / `forest` / `base`）
- **回退代码** —— 在 `/tree` 回退到历史消息时，可选择**同时恢复文件变更**（`/fork` 仅回退消息）；由内置 `rewind-code` 扩展实现（基于文件快照，支持 Accept / Revert）
- **MCP 支持** —— 接入 Model Context Protocol 服务器（stdio 或 HTTP，用户 / 项目作用域配置）：通过 `mcp_tool_search` / `mcp_tool_call` 发现并调用其工具 / 资源，提示词以 `/mcp__<服务器>__<提示词>` 形式暴露为 Slash 命令，并可从聊天工具栏抽屉或 `/mcp` 命令实时管理连接（start / stop / reconnect、空闲自动断开）
- **技能管理** —— 可视化面板，在用户 / 项目作用域内创建、编辑、删除 pi 技能（带 YAML frontmatter 的 SKILL.md）
- **VS Code 桥接** —— 内置 pi 扩展与本地 HTTP 桥接服务，为状态栏与 Slash 命令提供实时编辑器数据
- **实时 VS Code 状态栏** —— pi 终端底部状态条实时显示当前文件、光标 / 选区、语言、未保存标记和诊断数量
- **诊断工具** —— Agent 可通过 `vscode_get_diagnostics` 按需读取 VS Code 诊断（LSP / lint / 类型错误）
- **Slash 命令** —— `/vscode-selection` 与 `/vscode-diagnostics` 将当前选区或诊断以用户消息的形式注入对话；其余编辑器能力刻意不对模型开放
- **AI 驱动的 Git 提交信息** —— 基于 pi 从暂存区变更生成语义化 commit message，支持 14 种语言与自定义提示模板
- **会话恢复** —— 按工作区持久化 pi 会话，IDE 重启后通过 `--session` 自动续接
- **完整设置面板** —— 统一的 webview 编辑器，一站式管理：Models（Providers / OAuth / API Keys）、Agents、Prompt Templates、Skills、MCP Servers（stdio / http 传输选择器）、**Commit Message**（模型 / 语言 / 自定义提示词）与 Settings（内联 `settings.json` 编辑器 + 系统提示 Append / Override），全部直接读写 `~/.pi/agent/*.json`；Models 标签页还提供**高级 Provider / 模型兼容性选项**：按模型覆盖 API 协议与 base URL、支持 env / command 占位符的自定义请求头、OpenAI / Anthropic 兼容字段、成本分层与思考级别映射
- **本地化** —— 扩展内置**英文与简体中文**两套语言：`pi-agent-studio.language`（`auto` 跟随 VS Code 显示语言，也可强制 `en` / `zh-cn`）覆盖清单、侧边栏、聊天面板、设置面板与 commit message 生成器
- **侧边栏视图** —— `Sessions`（新建 / 恢复 / 切换会话，含实时状态图标）与精简版 `Settings` 侧边栏（环境信息、升级、跳转完整设置面板）
- **危险命令审批** —— 内置 permission gate，拦截 `rm -rf`、`sudo` 等危险 bash 命令，执行前需人工批准；支持 `AskForApproval` / `FullAccess` 模式与自定义危险模式
- **编辑器标题栏按钮** —— 编辑器标题栏快捷打开 pi
- **自动检测 pi 二进制** —— 自动从常见路径定位（`~/.bun/bin`、`~/.local/bin`、`~/.npm-global/bin`；Windows 上额外探测 `%APPDATA%/npm`、`%LOCALAPPDATA%/pnpm`）

## 环境要求

- **VS Code ≥ 1.100.0**（扩展的 engine 要求为 `^1.100.0`）
- 已安装 `pi` CLI：

  ```bash
  npm install -g --ignore-scripts @earendil-works/pi-coding-agent
  # 或
  bun add -g --ignore-scripts @earendil-works/pi-coding-agent
  # 或
  pnpm add -g --ignore-scripts @earendil-works/pi-coding-agent
  # 或
  yarn global add --ignore-scripts @earendil-works/pi-coding-agent
  ```

- 至少为一个 Provider 配置 API Key 或 OAuth 凭据 —— 在设置面板的 **Models** 标签页管理

## 安装

已上架 [VS Code Marketplace](https://marketplace.visualstudio.com/items?itemName=johnny-zhao.pi-agent-studio) 与 [Open VSX](https://open-vsx.org/extension/johnny-zhao/pi-agent-studio)：

```bash
# VS Code / Cursor
code --install-extension johnny-zhao.pi-agent-studio

# Open VSX（VSCodium 等）
ovsx get johnny-zhao/pi-agent-studio
```

## 命令

| 命令                                 | 快捷键        | 说明                                                                         |
| ------------------------------------ | ------------- | ---------------------------------------------------------------------------- |
| `Pi: Open`                           | `Alt+Shift+P` | 在编辑器旁打开或聚焦 pi 终端                                                 |
| `Pi: Open in New Window`             | —             | 打开 pi 终端并将其移动到新窗口                                               |
| `Pi: Open Here`                      | —             | 在选中文件夹中打开 pi 终端（通过资源管理器右键菜单）                         |
| `Pi: Upgrade Pi`                     | —             | 调用 `pi update` 升级 pi（离线时回退到推断的包管理器）                       |
| `Pi: Open settings.json`             | —             | 在编辑器中打开 `~/.pi/agent/settings.json`（不存在时创建 `{}`）              |
| `Pi: Open models.json`               | —             | 在编辑器中打开 `~/.pi/agent/models.json`（不存在时创建 `{ providers: {} }`） |
| `Pi: Open Settings`                  | `Alt+Shift+,` | 打开完整设置面板（聊天面板齿轮按钮与状态栏按钮亦可）                         |
| `Pi: Generate Commit Message`        | —             | 基于 pi 从暂存区生成 AI Git commit message                                   |
| `Pi: Generate Commit Message - Stop` | —             | 中止正在进行的 commit message 生成                                           |

**Pi: Open** 命令同时绑定在编辑器标题栏上，可一键打开。

## 侧边栏

活动栏中的 **Pi** 图标会展开包含两个 webview 的侧边栏：

- **Sessions** -- 按工作区显示会话列表，带实时运行 / 空闲状态图标；多根工作区时显示下拉切换
- **Settings** -- 环境信息、快捷链接、`Upgrade Pi` 按钮，以及 `Full Settings` 跳转按钮；当 pi 缺失时显示首次运行**引导卡片**（Node ≥ 22.19.0 / npm / pi 检查项、仅链接的安装步骤与重启提示——PATH 变更需重启 VS Code 生效）

### 完整设置面板

**Settings** 侧边栏的跳转按钮（或 `Pi: Open Settings` 命令）会打开一个单实例编辑器面板，共七个标签页，数据按标签页惰性加载：

- **Models** —— 三个子标签页：
  - **Providers** —— 在 `~/.pi/agent/models.json` 中新增 / 重命名 / 编辑 / 删除自定义 Provider；支持按 Provider 配置 `authHeader` 开关与自定义请求头（env / command 占位符）、按模型覆盖 API 协议与 base URL、OpenAI / Anthropic 兼容字段、**采样参数**、成本分层与思考级别映射
  - **OAuth** —— 通过内置 `AuthStorage` 登录支持 OAuth 的 Provider
  - **API Keys** —— 管理 `~/.pi/agent/auth.json` 中保存的 API Key
- **Agents** -- 管理用户 / 项目级 subagent 定义，供内置 `subagent` 工具使用
- **Prompt Templates** -- 在用户 / 项目作用域内创建 / 编辑 / 删除 / 打开 pi 提示词模板（带 YAML frontmatter 的 markdown）
- **Skills** -- 在用户 / 项目作用域内创建 / 编辑 / 删除 pi 技能（SKILL.md）；外部技能只读展示，可打开源文件
- **MCP Servers** -- 在用户（`~/.pi/agent/mcp.json`）与项目（`.pi/mcp.json`）作用域内新增 / 编辑 / 删除 MCP 服务器配置，合并为带来源徽标的去重列表；显式**传输方式选择器**（stdio / http）只展示对应字段——stdio 为 command/args/env/cwd，http 为 url/headers/bearerToken，另有每台服务器的 `directTools` 配置
- **Commit Message** —— 配置 AI 生成提交信息功能：模型（`provider/model`）、输出语言与自定义提示词模板，直接写入 VS Code 设置
- **Settings** —— 两个分区：
  - **System Prompt** -- **Append** → `~/.pi/agent/APPEND_SYSTEM.md`（追加到 pi 系统提示）、**Override** → `~/.pi/agent/SYSTEM.md`（完全替换 pi 系统提示）
  - **settings.json** -- `pi-agent-studio.*` 配置的内联编辑器，直接保存到 VS Code 设置
  - **pi 设置** —— 包括 TUI 模式（`regular` / 实验性 `fullscreen`）、全屏滚动条，以及 Mermaid 渲染模式（`off` / `final` / `streaming`）

## 桥接：LLM 工具、Slash 命令与状态栏

每个由本扩展启动的 pi 终端都会加载一个内置 pi 扩展，该扩展仅通过本地 HTTP 桥接访问 VS Code。桥接服务于三件事：

1. **实时状态栏** -- 每 ~1.5 秒刷新 pi TUI 底部状态条：活动文件、光标 / 选区、语言、脏状态、诊断数量。可通过 `pi-agent-studio.statusBar` 关闭
2. **1 个 LLM 工具** -- Agent 可自主读取诊断；其他操作刻意**不**对模型开放。可通过 `pi-agent-studio.disabledTools` 按工具禁用
3. **Slash 命令** —— 由用户手动触发，读取实时编辑器上下文后以用户消息注入对话

> **设计考量。** 早期版本一口气暴露 25 个工具给模型。工具过多会污染上下文，也会诱导模型绕过编辑器直改文件。现在的设计是：**带入实时编辑器上下文这件事由人明示触发的 Slash 命令控制**，模型不能额外索取。

### 内置桥接扩展

除编辑器桥接外，本扩展还内置了几个面向 Agent 的 pi 扩展（工具与命令，可通过 `pi-agent-studio.disabledTools` 禁用）：

- **todo** -- `todo` LLM 工具，配输入框上方的实时列表 widget，以及 `/todos`、`/todo-clear` 命令
- **questionnaire** -- 让 Agent 提出结构化问题（webview 模式下渲染为原生表单）
- **subagent** -- 将任务委派给专门 Agent（内置 `explore`、`general`，可自定义）；在设置面板的 **Agents** 标签页管理
- **permission-gate** -- 拦截危险 bash 命令（匹配 `pi-agent-studio.permission.dangerousPatterns`，如 `rm -rf`、`sudo`），执行前需人工批准；可通过 `/permission` 按会话切换模式
- **rewind-code** -- 基于文件内容快照，在通过 `/tree` 回退历史消息时可选择同时恢复其代码变更（`/fork` 仅回退消息）；webview 面板中驱动实时变更文件 widget，支持 Accept / Revert
- **btw** -- `/btw` 提问旁路问题，不污染主对话上下文
- **mcp** -- 会话启动时自动连接配置的 MCP 服务器（stdio 或 StreamableHTTP→SSE），将其工具 / 提示词注册进 pi，并驱动聊天工具栏的 MCP 服务器抽屉（在设置面板的 **MCP Servers** 标签页管理；可通过 `pi-agent-studio.mcp.enabled` 开关）

### LLM 工具（1 个）

| 工具                     | 返回内容                                                 |
| ------------------------ | -------------------------------------------------------- |
| `vscode_get_diagnostics` | 指定文件或整个工作区的 VS Code 诊断（LSP / lint / 类型） |

可选参数 `filePath`（绝对路径或工作区相对）；不传则返回整个工作区的诊断。

### Slash 命令（2 个）

在 pi 终端输入即可。参数缺省时，命令会从 **当前 VS Code 状态** 推断；调用桥接后，结果 JSON 以用户消息的形式注入对话，模型随即看到并反应。

| 命令                                        | 参数                   | 行为                                                                           |
| ------------------------------------------- | ---------------------- | ------------------------------------------------------------------------------ |
| `/vscode-selection [intent?]`               | 可选意图文本           | 返回当前选区（文本 / 路径 / 坐标）；后面多余文本会被当作意图拼接在注入消息前面 |
| `/vscode-diagnostics [filePath?] [intent?]` | 可选文件路径，可选意图 | 返回 `filePath` 的诊断；缺省时取当前活动文件。非路径 token 会被当作意图        |

示例：

```text
/vscode-selection 解释一下这段正则
/vscode-diagnostics src/extension.ts 为什么报错？
/vscode-diagnostics                  # → 当前活动文件的诊断
```

### 说明

- Slash 命令参数采用简单启发式：包含 `/`、`\` 或 `.` 的 token 被视为文件路径，其他被视为意图文本
- 文件路径可为绝对路径或工作区相对路径
- 桥接 RPC 层（`src/bridge/handlers.ts`）仍实现了完整的编辑器能力（选区、符号、定义、引用、悬浮、code action、格式化、工作区编辑、保存、通知 ……）。它们在内置桥接中可调用，但目前**不**作为 LLM 工具或 Slash 命令注册，留作未来明示命令的备用
- 大响应的 JSON 会被截断，结果为包含 `truncated: true`、原始大小元数据与 `resultJsonPrefix` 预览的有效 JSON 包装

## 配置项

| 设置项                                         | 类型      | 默认值              | 说明                                                                                                   |
| ---------------------------------------------- | --------- | ------------------- | ------------------------------------------------------------------------------------------------------ |
| `pi-agent-studio.path`                         | `string`  | `""`                | pi 二进制的绝对路径（留空则自动检测）                                                                  |
| `pi-agent-studio.bridgeSocket`                 | `string`  | `""`                | 桥接端点：留空 = 随机端口；数字 = 固定端口；其他 = socket 路径（Windows：命名管道），支持 `{windowId}` |
| `pi-agent-studio.language`                     | `string`  | `"auto"`            | 界面语言：`auto`（跟随 VS Code 显示语言）、`en` 或 `zh-cn`                                             |
| `pi-agent-studio.env`                          | `object`  | `{}`                | 合并到 pi 终端的环境变量（与桥接变量冲突时桥接变量优先）                                               |
| `pi-agent-studio.args`                         | `array`   | `[]`                | 追加到 `--extension` 之后、调用方额外参数之前的 CLI 参数                                               |
| `pi-agent-studio.commitLanguage`               | `string`  | `"English"`         | 生成 Git commit message 的语言（支持 14 种语言）                                                       |
| `pi-agent-studio.commitMessagePrompt`          | `string`  | `""`                | commit message 生成的自定义系统提示                                                                    |
| `pi-agent-studio.commitModel`                  | `string`  | `""`                | commit message 生成所用模型，格式 `provider/model`（如 `Zai/glm-5.2`）                                 |
| `pi-agent-studio.statusBar`                    | `boolean` | `true`              | 在 pi TUI 底栏显示实时 VS Code 上下文（编辑器、选区、诊断）                                            |
| `pi-agent-studio.ui`                           | `string`  | `"terminal"`        | `Pi: Open` 的界面：`terminal`（TUI）或 `webview`（聊天面板）                                           |
| `pi-agent-studio.disabledTools`                | `array`   | `[]`                | 可禁用的内置 LLM 工具：`vscode_get_diagnostics`、`todo`、`questionnaire`、`subagent`                   |
| `pi-agent-studio.rpcTrace`                     | `boolean` | `false`             | 将 RPC 流量与 pi stderr 输出到 "Pi Chat RPC" 输出通道                                                  |
| `pi-agent-studio.permission.mode`              | `string`  | `"AskForApproval"`  | 危险 bash 命令门禁：`AskForApproval`（执行前询问）或 `FullAccess`                                      |
| `pi-agent-studio.permission.dangerousPatterns` | `array`   | 请看 "package.json" | 匹配危险 bash 命令、需审批的正则（大小写不敏感；用户配置会整体替换默认值）                             |
| `pi-agent-studio.chatFontSize`                 | `number`  | `13`                | webview 聊天面板字体大小（范围 8–32）                                                                  |
| `pi-agent-studio.chatMermaidTheme`             | `string`  | `"default"`         | webview 聊天面板的 Mermaid 图表主题（`default` / `neutral` / `dark` / `forest` / `base`）              |
| `pi-agent-studio.mcp.enabled`                  | `boolean` | `true`              | 是否加载内置 MCP 桥接扩展（将已配置 MCP 服务器的工具 / 资源 / 提示词暴露给 pi）                        |
| `pi-agent-studio.mcp.idleTimeout`              | `number`  | `10`                | 空闲 MCP 服务器自动断开前的分钟数（缓存元数据仍可搜索）；`0` 表示禁用自动断开                          |

## 从源码构建

```bash
pnpm install
pnpm build         # rolldown 打包 → dist/extension.cjs
pnpm package       # 构建 + vsce package --no-dependencies
pnpm install-local # 打包并安装到本地 VS Code
```

常用开发命令：

- `pnpm dev` —— rolldown watch 模式
- `pnpm fmt` —— `oxlint --fix` + `oxfmt`
- `pnpm lint` —— `oxlint . && oxfmt --check .`
- `pnpm typecheck` —— `tsgo --noEmit --skipLibCheck`
- `pnpm vitest run` —— 运行测试套件

## 更新日志

详见 [CHANGELOG.md](./CHANGELOG.md)。

## 许可证

[MIT](./LICENSE)
