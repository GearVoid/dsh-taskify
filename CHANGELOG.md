# 更新记录

本项目遵循 [Semantic Versioning](https://semver.org/)。中文为默认发布语言，关键术语保留英文以便与 DSH API 对照。

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

[0.3.0]: https://github.com/GearVoid/dsh-taskify/compare/v0.2.0...v0.3.0
[0.2.0]: https://github.com/GearVoid/dsh-taskify/compare/v0.1.0...v0.2.0
[0.1.0]: https://github.com/GearVoid/dsh-taskify/releases/tag/v0.1.0
