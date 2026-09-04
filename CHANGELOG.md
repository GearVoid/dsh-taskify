# 更新记录

本项目遵循 [Semantic Versioning](https://semver.org/)。中文为默认发布语言，关键术语保留英文以便与 DSH API 对照。

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
