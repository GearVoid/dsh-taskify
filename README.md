# DSH Taskify

**简体中文** | [English](./README_EN.md)

## 在 Agent 执行前，把你明确说过的边界锚定下来

DSH Taskify 是面向 DeepSeek Harness Web 的轻量级 **Intent Anchor** 插件。它从当前输入中提取少量、明确、可追溯的硬约束，同时完整保留用户原文。

> Raw Prompt is the source of truth. Extract, don't invent.

### 原始任务 → 🔒 Constraint Chips → Send

![DSH Taskify v0.2：从原始任务提取只读约束并发送](./assets/demo.gif)

[![DeepSeek Harness Core](https://img.shields.io/badge/DSH_Core-0.1.0--rc.6-4f46e5)](https://github.com/deepseek-ai/deepseek-harness)
[![Release](https://img.shields.io/github/v/release/GearVoid/dsh-taskify)](https://github.com/GearVoid/dsh-taskify/releases/latest)
[![License](https://img.shields.io/github/license/GearVoid/dsh-taskify)](./LICENSE)
![Web Profile](https://img.shields.io/badge/Profile-Web-10b981)

## 一行安装

```sh
dsh plugin --profile web add github:GearVoid/dsh-taskify#v0.2.0
```

然后启动或重启 DeepSeek Harness Web：

```sh
dsh web
```

## 使用效果

输入：

> dashboard 太乱了，帮我整理下，后端别动，功能也别删。

点击 `✨ Taskify` 后，输入框内容保持不变，附近显示只读 Chips：

```text
🔒 不修改后端
🔒 保留现有功能
```

悬停或聚焦 Chip 可检查原文证据：

```text
来源：“后端别动”
```

如果当前输入没有明确硬约束，Taskify 会正常显示：

```text
✓ 未发现需要额外锚定的约束
```

## 工作方式

```text
当前用户草稿
   ↓
解析 Slash 命令正文
   ↓
保护代码、路径和其他字面量
   ↓
使用当前会话模型提取 Anchor + Evidence
   ↓
校验证据、约束强度与具体代码事实
   ↓
显示只读 Chips（原文不变）
   ↓
用户手动发送
   ↓
Raw Prompt + User-level Taskify Constraint Contract
```

Taskify 不读取最近对话来恢复旧约束，不搜索工作区，也不生成目标、计划、验收标准或工程建议。

## Anchor Contract

```json
{
  "anchors": [
    {
      "text": "不修改后端",
      "evidence": "后端别动"
    }
  ]
}
```

每个 Anchor 必须能追溯到当前用户草稿中的精确 evidence。`尽量简单`、`最好别碰后端` 等偏好性或弱化表达不会被升级为硬约束。`anchors: []` 是合法成功结果。

## 发送给 Agent

用户仍通过 DSH 原有发送按钮手动发送。原始消息保持原样；当消息与已锚定草稿精确匹配时，Taskify 通过 DSH 官方 `agent/pre-step` 扩展点追加一条用户角色、插件来源的消息：

```xml
<taskify_constraints>
- 不修改后端
- 保留现有功能
</taskify_constraints>
```

约束不会进入 System Prompt，也不会获得高于用户原话的指令权限。无 Anchor 时不附加空模板。

## 安全与状态

- **Literal Lock**：保护代码块、行内代码、路径、URL、IP/端口、版本、CLI 和常见标识符。
- **Provenance**：evidence 必须是当前草稿的精确子串。
- **Concrete Claim Guard**：Anchor 不能凭空加入新路径、URL、CLI、版本或明显代码标识符。
- **Revision / Race Protection**：请求期间草稿变化会丢弃旧结果并清理 Host 状态。
- **只读 Chips**：不编辑、不删除；修改 Raw Prompt 会立即使 Chips 失效。
- **Cancel / Retry**：提取中可取消，失败后可重试。
- **Session 隔离**：请求和 Anchor 按会话隔离；成功注入后一次性消费。
- **Reference 安全策略**：含 Reference Chip 的草稿暂不提取约束。

## 兼容性

- DeepSeek Harness 启动器：`0.1.1-rc.2`
- DSH 核心插件 API：`0.1.0-rc.6`
- DSH Web Client API：`0.0.1-rc.1`
- Node.js：`^22.19.0 || >=24.0.0`
- pnpm：`11.x`（本仓库使用 `11.19.0`）

DSH 仍处于 Developer Preview，存在兼容性破坏的可能。

## 开发与测试

```sh
pnpm install --frozen-lockfile
pnpm test
pnpm build
pnpm pack:check
```

测试覆盖 Anchor 提取结果校验、无凭据约束拒绝、模态强度保护、Literal preservation、Empty Anchor、Provenance、无 Prompt Rewrite、草稿竞态、取消、Session 隔离和 User-level Contract 注入。

## 项目结构

```text
src/host/       模型调用、Anchor 激活与 Agent 注入
src/client/     Taskify 按钮、只读 Chips 与草稿失效逻辑
src/shared/     Compiler、Literal Lock、Schema、Slash 和 Session Runner
scripts/        Client Bundle 构建脚本
test/           Node.js 测试
client.js       构建后的浏览器端 Bundle
cordis.patch.yml
```

## 许可证

[MIT](./LICENSE)
