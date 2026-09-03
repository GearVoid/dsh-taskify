# DSH Taskify

**简体中文（默认）** | [English](./README_EN.md)

## 让 DeepSeek Harness 在长任务里记住“这次只做什么”和“什么不能动”

“后端别动”、“功能别删”、“API 保持不变”、“不要新增依赖”——这些边界经常埋在自然语言里，也最容易在长任务中逐轮漂移。

DSH Taskify 不重写你的 Prompt。它用一个 **🎯 Focus** 表示当前 Session 最多要完成什么，并把你明确说过的硬约束显示为可审阅、可追溯的 **Persistent Anchors（持久锚点）**。Focus 与 active Anchors 会持续进入当前 Session 的模型上下文，直到你主动修改其生命周期。

> 把 dashboard 做好看点，后端别动，功能别删，也不要增加新的依赖。

```text
🎯 Focus：调整 dashboard 的布局与视觉
🔒 后端不修改　 🔒 保留现有功能　 🔒 不新增依赖
```

**Focus 管执行范围，Anchors 钉住不能改变的底线；原始 Prompt 一字不改。**

![DSH Taskify 交互演示](./assets/demo.gif)

[![DeepSeek Harness Core](https://img.shields.io/badge/DSH_Core-0.1.0--rc.6-4f46e5)](https://github.com/deepseek-ai/deepseek-harness)
[![Release](https://img.shields.io/github/v/release/GearVoid/dsh-taskify)](https://github.com/GearVoid/dsh-taskify/releases/latest)
[![License](https://img.shields.io/github/license/GearVoid/dsh-taskify)](./LICENSE)
![Web Profile](https://img.shields.io/badge/Profile-Web-10b981)

## v0.4 有什么不同

v0.4 在 Host-owned Persistent Anchors 之外增加 Session Focus，并把两者一起作为后续轮次的持续模型指导。

```text
当前草稿
   ↓ 点击 Taskify
AI 建议 Focus（可编辑、可忽略）+ 待发送 Anchors
   ↓ 用户确认 Focus 建议（不会自动生效）
   ↓ 发送完全匹配的原始消息
Host 激活 Persistent Anchors，并在 turn settle 后应用已确认的 Focus
   ↓
Focus + active Anchors 在后续每一轮进入模型上下文
   ↓
用户管理各自的生命周期
```

- **一个 Session，一个 Focus**：Focus 是当前 Session 的用户授权执行边界，可手写设置，也可采用 AI 建议。
- **建议必须确认**：AI Focus suggestion 只是 Client 可见草稿；只有用户点击“设为 Focus”后才会成为 Host authoritative Focus。
- **完整生命周期**：Focus 支持 Set、Edit、Pause、Resume、Clear；Anchors 支持 Pause、Resume、Remove、Clear All。
- **联合运行时指导**：后续轮次同时携带 active Focus 与 active Anchors。
- **Host 权威状态**：Client 只是快照缓存；刷新、重挂载和事件重放后以 Host 为准。
- **可恢复表示**：使用 DSH 已知的 Session Event 与 UserMessage 表示状态，不写自定义上游事件。
- **Anchor 降噪**：extraction 会排除已有约束，Host 与 Client 还会按 exact text 确定性过滤 persistent/pending 重复项。
- **严格会话作用域**：新会话和 fork 不自动继承父会话 Focus 或 Anchors。

## 一行安装或更新

```sh
dsh plugin --profile web add github:GearVoid/dsh-taskify#v0.4.0
```

然后重新启动 DeepSeek Harness Web：

```sh
dsh web
```

如果已经安装旧版本，重新执行同一条 `plugin add` 命令并重启 DSH Web，以加载新的 Host 代码和 Client bundle。

## 使用方法

1. 在 DSH Web 输入原始任务。
2. 点击 `✨ Taskify`。
3. 核对 AI 建议的 Focus 与带有共享“待发送”状态的 Anchor Chips。
4. Focus 建议可直接确认、编辑后确认或忽略；也可以手写设置 Focus。
5. 使用 DSH 原有发送按钮发送原始消息。
6. 发送完成后，Anchors 变为当前 Session 的 active 持久约束；已确认的 Focus 在 Host request 回到 idle 后生效。

例如输入：

> dashboard 太乱了，帮我整理下，后端别动，功能也别删。

Taskify 不修改输入框内容，只显示独立的 Focus 建议与 Anchors：

```text
🎯 建议 Focus：整理 dashboard 布局
🔒 不修改后端　🔒 保留现有功能　· 待发送
```

AI 建议不会自动写入 Host Focus。只有用户确认后，它才会通过现有 Focus mutation 成为权威状态。发送后，active Focus 与 Anchors 会继续显示在下一轮输入框。Anchor 归纳文本与原文不同时，悬停或聚焦 Chip 可查看精确 evidence；active Anchor 可暂停、恢复、单独删除，也可以全部清空。

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

## Focus 与 Persistent Anchors

| | 🎯 Focus | 🔒 Persistent Anchors |
|---|---|---|
| 回答的问题 | 这次最多做到哪里 | 哪些东西不能变 |
| 数量 | 一个 Session 最多一个 | 一个 Session 可有多个 |
| 来源 | 用户手写，或 AI 建议后由用户确认 | 从当前 Prompt 提取，必须带 exact evidence |
| 生命周期 | Set / Edit / Pause / Resume / Clear | Pause / Resume / Remove / Clear All |
| 权威性 | 只有用户操作才能改变 Host Focus | 只有用户操作才能改变 active Anchor 状态 |

Focus 是持续的 model guidance，不是 mechanical enforcement。它帮助模型把工作限制在用户确认的执行范围内，但不会拦截文件写入、依赖安装或 Git 操作。

## 状态与安全边界

- **Literal Lock**：保护代码块、行内代码、路径、URL、IP/端口、版本、CLI 和常见标识符。
- **Provenance**：evidence 必须是当前草稿的精确子串。
- **Concrete Claim Guard**：Anchor 不能凭空加入新路径、URL、CLI、版本或明显代码标识符。
- **Revision / CAS**：Host 使用 revision 检查拒绝过期写入，冲突后 Client 重新读取权威快照。
- **Draft invalidation**：修改尚未发送的原始草稿只会使 pending/armed request 失效，不会删除 active Anchors。
- **Durable replay**：当 DSH persistence provider 确认 flush 时，状态可以通过已知事件重放恢复；失败或不可确认时会明确降级。
- **Runtime guidance**：后续轮次通过 DSH 官方 `systemPrompt.context` 同时获得当前 active Focus 与 active Anchors；paused 项不进入模型上下文。
- **Session isolation**：状态按精确 session id 隔离，默认不跨新会话或 fork 传播。

## 当前不做什么

Focus 与 Persistent Anchors 都是持续的模型指导，不是文件系统或 Git 层面的强制执行。v0.4 不包含：

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

当前测试覆盖 Focus suggestion 与生命周期、Anchor 提取及去重、Literal preservation、Provenance、草稿竞态、Host revision、durable replay、Session 隔离、联合运行时上下文以及 turn-settled Client convergence。

## 项目结构

```text
src/host/       Host 权威状态、激活绑定、持久化与运行时上下文
src/client/     Taskify 按钮、Focus/Anchor Dock 与 Client 快照收敛
src/shared/     Compiler、Schema、Projection、Session Runner
scripts/        Client bundle 构建脚本
test/           Node.js 测试
client.js       构建生成的浏览器端 bundle（请勿手工编辑）
cordis.patch.yml
```

更详细的历史设计记录见 [`docs/`](./docs/)。

## 许可证

[MIT](./LICENSE)
