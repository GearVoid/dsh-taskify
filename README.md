# DSH Taskify

**简体中文** | [English](./README_EN.md)

## 把随手一句需求，变成 Coding Agent 可以直接执行的任务

一个面向 DeepSeek Harness Web 的轻量级 **Task Compiler**。它不负责把 Prompt 写得更漂亮，而是让任务更容易被 Agent 正确执行。

[![DeepSeek Harness](https://img.shields.io/badge/DeepSeek_Harness-0.1.0--rc.6-4f46e5)](https://github.com/deepseek-ai/deepseek-harness)
[![Release](https://img.shields.io/github/v/release/GearVoid/dsh-taskify)](https://github.com/GearVoid/dsh-taskify/releases/latest)
[![License](https://img.shields.io/github/license/GearVoid/dsh-taskify)](./LICENSE)
![Web Profile](https://img.shields.io/badge/Profile-Web-10b981)

![DSH Taskify 演示：完善任务并撤回](./assets/demo.gif)

## 一行安装

```sh
dsh plugin --profile web add github:GearVoid/dsh-taskify#v0.1.0
```

然后启动或重启 DeepSeek Harness Web：

```sh
dsh web
```

“完善任务”按钮会出现在输入框右侧、模型选择器和发送按钮之前。

| ✨ 一键完善 | 🔒 Literal Lock | ↶ 随时撤回 | 🧠 有限上下文 |
| --- | --- | --- | --- |
| 整理当前草稿 | 保护代码与路径 | 恢复原始输入 | 理解最近对话 |

## Before → After

### Before

> 这个 dashboard 看着有点乱，帮我整理下，后端别动，功能也别删。

### After

```text
目标
优化当前 Dashboard 的前端信息层级和视觉秩序。

需要处理
- 调整布局、间距、对齐、字号与颜色层级
- 优先复用现有组件和设计变量
- 保持现有交互入口清晰可见

约束
- 不修改后端接口、业务逻辑或数据结构
- 不删除或改变现有功能
- 不进行无关页面改动

验收标准
- 主要信息层级清晰，关键操作易于识别
- 页面在现有断点下正常显示
- 原有功能与交互保持可用
```

## Why Taskify?

### 不是普通的 Prompt 润色器

Taskify 面向 Coding Agent 的执行过程整理目标、范围、约束和验收标准，并根据草稿清晰度控制结构与细节。

### Literal Lock

发送给模型前，代码块、行内代码、文件路径、URL、IP/端口、环境变量、版本号、CLI 参数和常见代码标识符会被临时锁定。返回后只有通过数量与顺序校验的结果才会恢复并写回。

### Safe by default

完善结果只回填输入框，绝不自动发送。请求期间如果草稿发生变化，旧结果不会覆盖新内容；应用后可以一键撤回到原始草稿。

## 更多能力

- **有限上下文**：可使用当前会话最近的少量已完成消息理解“这个页面”或“上一处修改”等指代，不读取工作区或搜索代码仓库。
- **Slash 命令保留**：`/plan` 等命令前缀保持不变，只完善命令后的任务正文。
- **复用当前模型**：优先使用当前会话选择的模型，不要求配置额外 API Key。
- **取消与重试**：完善过程中可以取消，失败后可以直接重试并查看错误提示。
- **Session 隔离**：请求、撤回点和错误状态按会话隔离。

## 使用方法

1. 在输入框写下任务草稿。
2. 点击“✨ 完善任务”。
3. 检查自动回填的任务规格。
4. 手动发送，或点击“↶ 撤回”恢复原文。

## 按钮状态

| 状态 | 行为 |
| --- | --- |
| 空输入 | “完善任务”不可用 |
| 可完善 | 点击后开始整理当前草稿 |
| 完善中 | 显示静态 `✨` 和“完善中…”，点击可取消 |
| 已应用 | 点击“撤回”恢复原始草稿 |
| 应用后编辑 | 可以再次完善 |
| 失败 | 显示错误提示，可以重试 |

## 工作方式

```text
当前草稿
   ↓
解析 Slash 命令
   ↓
保护代码、路径和其他字面量
   ↓
结合有限的最近对话
   ↓
调用当前会话模型
   ↓
校验并恢复受保护内容
   ↓
确认草稿没有被用户修改
   ↓
回填输入框（不会自动发送）
```

## 安全与隐私

- 不读取工作区文件或搜索代码仓库
- 不读取 `.env`、SSH Key 或本地凭据文件
- 不访问额外的第三方服务
- 不自动发送或提交完善后的任务
- 最近对话仅保留有限文本，并过滤常见凭据形状
- 包含 Reference Chip 的草稿在当前版本中不会被完善

## 兼容性

- 已在 DeepSeek Harness `0.1.0-rc.6` 上验证
- Web Profile
- 不修改 DeepSeek Harness 本体或 Agent Preset

DeepSeek Harness 仍处于快速迭代阶段，后续版本可能需要同步适配。

## 开发与测试

```sh
pnpm install
pnpm test
pnpm build
```

测试覆盖 Literal Lock、路径和 URL、Slash 命令、取消、草稿竞态、Provider 错误、输出截断、撤回、Session 隔离、Reference Chip 策略和安全回填。

## 项目结构

```text
src/host/       模型调用与 Host 服务
src/client/     输入框按钮、交互状态与 RPC
src/shared/     Literal Lock、上下文、Schema 和 Session Runner
scripts/        Client Bundle 构建脚本
test/           Node.js 测试
client.js       构建后的浏览器端 Bundle
cordis.patch.yml
```

## 许可证

[MIT](./LICENSE)
