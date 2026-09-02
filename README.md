# DSH Taskify

**简体中文（默认）** | [English](./README_EN.md)

## 给 DeepSeek Harness 会话加一组不会在下一轮消失的硬约束

“后端别动”、“功能别删”、“API 保持不变”、“不要新增依赖”——这些边界经常埋在自然语言里，也最容易在长任务中逐轮漂移。

DSH Taskify 不重写你的 Prompt。它只提取你明确说过的硬约束，显示为可审阅、可追溯的 **Persistent Anchors（持久锚点）**。发送原任务后，这些锚点会在当前 DSH 会话中持续生效，直到你主动暂停、恢复、删除或清空。

> 把 dashboard 做好看点，后端别动，功能别删，也不要增加新的依赖。

```text
🔒 后端不修改　 🔒 保留现有功能　 🔒 不新增依赖
```

**原文一字不改。Taskify 只把底线单独钉住。**

![DSH Taskify 交互演示](./assets/demo.gif)

[![DeepSeek Harness Core](https://img.shields.io/badge/DSH_Core-0.1.0--rc.6-4f46e5)](https://github.com/deepseek-ai/deepseek-harness)
[![Release](https://img.shields.io/github/v/release/GearVoid/dsh-taskify)](https://github.com/GearVoid/dsh-taskify/releases/latest)
[![License](https://img.shields.io/github/license/GearVoid/dsh-taskify)](./LICENSE)
![Web Profile](https://img.shields.io/badge/Profile-Web-10b981)

## v0.3 有什么不同

v0.2 的 Anchor 只服务一次发送；v0.3 将状态所有权迁移到 Host，并把 Anchor 升级为当前会话内的持久约束。

```text
当前草稿
   ↓ 点击 Taskify
待发送 Anchor（仍可核对原文证据）
   ↓ 发送完全匹配的原始消息
Host 激活为 Session-scoped Persistent Anchor
   ↓
后续每一轮继续进入模型上下文
   ↓
用户可 Pause / Resume / Remove / Clear All
```

- **跨轮持续**：第一轮激活后，后续轮次继续携带 active Anchors。
- **Host 权威状态**：Client 只是快照缓存；刷新、重挂载和事件重放后以 Host 为准。
- **可恢复表示**：使用 DSH 已知的 Session Event 与 UserMessage 表示状态，不写自定义上游事件。
- **显式生命周期**：只有用户可以暂停、恢复、删除或清空；Agent 不能修改 Anchor 状态。
- **确定性收敛**：一次模型轮次结束后，Client 重新读取 Host 快照，下一轮输入框立即显示 active Anchors。
- **严格会话作用域**：新会话和 fork 不自动继承父会话 Anchors。

## 一行安装或更新

```sh
dsh plugin --profile web add github:GearVoid/dsh-taskify#v0.3.0
```

然后重新启动 DeepSeek Harness Web：

```sh
dsh web
```

如果已经安装旧版本，重新执行同一条 `plugin add` 命令并重启 DSH Web，以加载新的 Host 代码和 Client bundle。

## 使用方法

1. 在 DSH Web 输入原始任务。
2. 点击 `✨ Taskify`。
3. 核对带有“待发送激活”标记的只读 Anchor Chips。
4. 使用 DSH 原有发送按钮发送原始消息。
5. 发送完成后，Anchor 变为当前会话的 active 持久约束。

例如输入：

> dashboard 太乱了，帮我整理下，后端别动，功能也别删。

Taskify 不修改输入框内容，只显示：

```text
🔒 不修改后端　待发送激活
🔒 保留现有功能　待发送激活
```

发送后，这些 Anchor 会继续显示在下一轮输入框。悬停或聚焦 Chip 可查看精确原文证据；active Anchor 可暂停、恢复、单独删除，也可以全部清空。

如果当前输入没有明确硬约束，Taskify 会正常显示：

```text
✓ 未发现需要额外锚定的约束
```

## 提取规则

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

每个 Anchor 必须能追溯到当前草稿中的精确 evidence。`尽量简单`、`最好别碰后端` 等偏好性或弱化表达不会被升级为硬约束。`anchors: []` 是合法成功结果。

Taskify 不搜索工作区，不生成目标、计划、验收标准或工程建议，也不重新实现 DSH `/goal`。

## 状态与安全边界

- **Literal Lock**：保护代码块、行内代码、路径、URL、IP/端口、版本、CLI 和常见标识符。
- **Provenance**：evidence 必须是当前草稿的精确子串。
- **Concrete Claim Guard**：Anchor 不能凭空加入新路径、URL、CLI、版本或明显代码标识符。
- **Revision / CAS**：Host 使用 revision 检查拒绝过期写入，冲突后 Client 重新读取权威快照。
- **Draft invalidation**：修改尚未发送的原始草稿只会使 pending/armed request 失效，不会删除 active Anchors。
- **Durable replay**：当 DSH persistence provider 确认 flush 时，状态可以通过已知事件重放恢复；失败或不可确认时会明确降级。
- **Runtime guidance**：后续轮次通过 DSH 官方 `systemPrompt.context` 获得当前 active Anchors；paused Anchors 不进入模型上下文。
- **Session isolation**：状态按精确 session id 隔离，默认不跨新会话或 fork 传播。

## 当前不做什么

Persistent Anchors 是持续的模型指导，不是文件系统或 Git 层面的强制执行。v0.3 不包含：

- 依赖安装拦截、文件写入拦截或自动回滚；
- Git baseline、Minimal Diff Mode 或 semantic diff audit；
- 原生 Goal 生命周期集成；
- watchState、轮询、WebSocket 或多客户端实时同步；
- 自动判断任务完成并过期 Anchor。

## 兼容性

- DeepSeek Harness 启动器：`0.1.1-rc.2`
- DSH 核心插件 API：`0.1.0-rc.6`
- DSH Web Client API：`0.0.1-rc.1`
- Node.js：`^22.19.0 || >=24.0.0`
- pnpm：`11.x`（本仓库使用 `11.19.0`）

DSH 仍处于 Developer Preview，未来版本可能带来兼容性变化。

## 开发与测试

```sh
pnpm install --frozen-lockfile
pnpm test
pnpm build
pnpm pack:check
```

当前测试覆盖提取校验、Literal preservation、Provenance、草稿竞态、Host revision、durable replay、Session 隔离、Anchor 生命周期、运行时上下文以及 turn-settled Client convergence。

## 项目结构

```text
src/host/       Host 权威状态、激活绑定、持久化与运行时上下文
src/client/     Taskify 按钮、Anchor Dock 与 Client 快照收敛
src/shared/     Compiler、Schema、Projection、Session Runner
scripts/        Client bundle 构建脚本
test/           Node.js 测试
client.js       构建生成的浏览器端 bundle（请勿手工编辑）
cordis.patch.yml
```

更详细的 v0.3 设计记录见 [`docs/`](./docs/)。

## 许可证

[MIT](./LICENSE)
