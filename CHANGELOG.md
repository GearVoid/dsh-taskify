# 更新记录

本项目遵循 [Semantic Versioning](https://semver.org/)。中文为默认发布语言，关键术语保留英文以便与 DSH API 对照。

## [0.5.0] - 2026-11-19

### 发布

- 将 `v0.5.0-rc.2` 的代码原样转正为 `v0.5.0`：目标 DSH `0.2.2-rc.1` / Cordis `4.1.0`，`engines.dsh` 保持 `>=0.2.2-rc.1 <0.2.3-0`。
- 无代码变更；差异仅为版本号、README 兼容性措辞和发布形态（正式版，不再标记 pre-release）。
- 154 项测试在 `0.2.2-rc.1` 与 `0.2.2-rc.5` 上通过；`pnpm install --frozen-lockfile`、Client bundle 构建、`pnpm pack:check` 通过。

### 已知边界

- 完整 DSH Web UI、实际模型调用与磁盘持久化重启仍未端到端验证；遇到问题可回退 `v0.5.0-rc.2`。
- 旧 DSH `0.2.1-rc.2` 用户使用 `v0.5.0-rc.1`，`0.1.2-rc.1` 用户使用 `v0.4.1`。

## [0.5.0-rc.2] - 2026-11-19

### 兼容性

- 将 DSH 依赖与兼容性声明更新到 `0.2.2-rc.1`，Cordis 跟进到 `~4.1.0`（本仓库锁定 `4.1.0`），同步 lockfile。
- `engines.dsh` 声明为 `>=0.2.2-rc.1 <0.2.3-0`：`0.2.2-rc.1` 与 `0.2.2-rc.5` 均通过同一套 154 项测试，patch 级 rc 更新不会再被版本门槛挡住。
- `AgentRegistry` 与 `AgentLoop` 改为在 Cordis init hook 中注册 `turnBoundary` / `modelSelection` / `inbox` 投影：测试 harness 现在手动执行同一个 init hook，`Inbox` 也改为接收投影 reader，与 0.2.2 的构造签名一致。
- 新增真实 Cordis fiber 管道挂载用例：`TaskifyService` 通过 `ctx.plugin()` 解析全部 `inject` 依赖、注册 Typert contribution、注入 runtime context，并在销毁时注销服务。
- Client 输入态现在按 `phase === 'plain'` 判定可用性，覆盖 0.2.2 新增的 `sending` 阶段。
- 复核确认 0.2.2 未改变 Taskify 依赖的宿主/浏览器契约：`bindTypertRemote` 签名、strict codec 形状、`session/event` 与 `agent/created` / `agent/disposed` 载荷、`systemPrompt.context`、`conversation.input.dock` / `conversation.input.right` 槽位及其 `sessionId` / `useSession` / `useInput` / `inputActions` props、`ctx.remote.$mount`。

### 验证与发布范围

- 154 项测试通过；Client bundle 构建、npm 打包检查通过。
- 本次仍为预发布：完整 DSH Web UI、实际模型调用和磁盘持久化重启仍需端到端验证。
- 旧 DSH `0.2.1-rc.2` 用户请继续使用 Taskify `v0.5.0-rc.1`；`0.1.2-rc.1` 用户请保留 `v0.4.1`。

## [0.5.0-rc.1] - 2026-10-20

### 兼容性与修复

- 将 DSH 依赖与兼容性声明更新到 `0.2.1-rc.2`，Cordis 固定为 `4.0.5`，同步 lockfile。
- 将 Host / Client Remote strict codec 迁移到 `create()` 工厂，修复新版 TypertRegistry 拒绝注册、导致插件无法加载的问题。
- 移除旧 `agent/session-start` 监听，继续通过 `agent/created` 初始化会话状态与 runtime context。
- 保留原有回归覆盖，将 Inbox 测试迁移到真实 AgentLoop 所拥有的实现，更新 Session replacement 的 `startSeq` / `endSeq` 字段。
- 新增真实 AgentLoop / TypertRegistry 集成测试，覆盖插件挂载、codec 校验、Focus 注入、Session 隔离和销毁。

### 验证与发布范围

- 153 项测试通过；Client bundle 构建、npm 打包检查通过。
- 本次为预发布：完整 DSH Web UI、实际模型调用和磁盘持久化重启仍需端到端验证。
- 旧 DSH `0.1.2-rc.1` 用户继续使用 Taskify `v0.4.1`。

## [0.4.1] - 2026-09-04

### 兼容性

- 将唯一支持的 DeepSeek Harness 基线切换到 `0.1.2-rc.1`。
- 使用新的 `Session.snapshotEvents()` replay API，并移除已废弃的 `dsh-client-runtime` 注入。

## [0.4.0] - 2026-09-03

### 新增

- 增加一个 Session 最多一个的 Host-owned Session Focus，支持用户 Set、Edit、Pause、Resume 与 Clear。
- 增加 AI Focus Suggestion：根据当前任务生成可编辑、可忽略的 Client draft；只有用户确认后才会成为 authoritative Focus，绝不自动生效。
- 后续轮次通过 `systemPrompt.context` 同时获得当前 active Focus 与 active Persistent Anchors。

### 改进

- extraction 接收已有 Persistent Anchor texts 作为 exclusion context，并在 Host/Client 侧按 exact text 确定性过滤 persistent/pending 重复项。
- 重做 Focus/Anchor Dock 视觉层级，精简 provenance tooltip、共享 pending 状态，并改善 Focus 编辑与 suggestion actions 布局。

### 说明

- Focus 与 Persistent Anchors 都是 model guidance，不是 mechanical enforcement。
- AI suggestion 始终只是临时草稿，不进入 durable replay；Focus authority、revision/CAS 与生命周期仍由 Host 管理。

## [0.3.0] - 2026-09-02

### 新增

- 将一次性的 Taskify Anchors 升级为 Host-owned、session-scoped Persistent Anchors。
- 支持用户显式暂停、恢复、删除单个 Anchor，以及清空当前会话全部 Anchors。
- 使用 DSH 已知 Session Events 与 UserMessages 表示并重放权威状态，无需修改 DeepSeek Harness upstream。
- 后续轮次通过官方 `systemPrompt.context` seam 持续获得当前 active Anchors。
- 在第一轮发送前显示“待发送激活”的 pending Anchor 状态。

### 修复

- 修复真实 DSH rc.2 事件序列下 activation carrier 重放可能丢失或重复的问题。
- 修复第一轮激活完成后 Client 未及时收敛，导致下一轮 composer 暂时看不到 active Anchors 的问题。
- 修复草稿变化路径误伤 persistent active Anchors 的风险；invalidate 只清理 pending/armed request。

### 说明

- v0.3 仍是模型指导层，不包含文件写入拦截、依赖拦截、Git baseline、semantic diff audit 或自动回滚。
- 当前只支持精确 Session scope；新会话和 fork 不继承 Anchors。
- 当前不实现 native Goal integration、watchState、轮询、WebSocket 或多客户端实时同步。

## [0.2.0] - 2026-08-25

- 引入可审阅、可追溯且不改写原始 Prompt 的 Intent Anchors。
- 增加 Literal Lock、Provenance、Concrete Claim Guard、草稿竞态保护和 Session 隔离。

## [0.1.0] - 2026-08-17

- 首次公开发布 DSH Taskify。

[0.4.1]: https://github.com/GearVoid/dsh-taskify/compare/v0.4.0...v0.4.1
[0.4.0]: https://github.com/GearVoid/dsh-taskify/compare/v0.3.0...v0.4.0
[0.3.0]: https://github.com/GearVoid/dsh-taskify/compare/v0.2.0...v0.3.0
[0.2.0]: https://github.com/GearVoid/dsh-taskify/compare/v0.1.0...v0.2.0
[0.1.0]: https://github.com/GearVoid/dsh-taskify/releases/tag/v0.1.0

[0.5.0-rc.1]: https://github.com/GearVoid/dsh-taskify/compare/v0.4.1...v0.5.0-rc.1
