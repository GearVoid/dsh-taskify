# DSH Taskify v0.2 项目改进策略（MVP 收敛版）

## 一、v0.2 的目标

v0.2 不再继续强化“提示词增强”。

新的核心目标是：

> **保留用户原始任务，从中提取少量、明确、可追溯的约束，帮助 Coding Agent 在执行过程中不要偏离用户已经明确表达的边界。**

一句话：

> **Taskify 从 Prompt Enhancer 变成 Intent Anchor。**

v0.2 不追求证明一套新的 Agent 理论，也不试图重新设计 DeepSeek Harness。

作为个人开发 MVP，本版本优先追求：

- 简单
- 可完成
- 易维护
- 和 DSH 边界清楚
- 相比 v0.1 有明显产品升级

---

## 二、v0.2 最重要的变化

### v0.1

```text
用户原始任务
    ↓
Taskify
    ↓
重新生成更完整的 Task Spec
    ↓
覆盖输入框
    ↓
用户发送
```

### v0.2

```text
用户原始任务
    ↓
Taskify
    ↓
提取明确 Constraint Anchors
    ↓
用户原文保持不变
    ↓
显示只读约束 Chips
    ↓
Raw Prompt + Anchors
    ↓
用户手动发送
```

也就是说：

> **不再改写 Prompt。**

这是 v0.2 最大、也是最值得做的产品变化。

---

## 三、v0.2 最小 Contract

第一版不要设计复杂 Schema。

只保留：

```yaml
anchors:
  - text: "不修改后端"
    evidence: "后端别动"
```

内部可以再记录：

```yaml
source: current_user
```

如果实现方便，也可以保存 span。

但核心就是：

```text
Anchor
+
Evidence
```

不需要更多。

---

## 四、什么可以成为 Anchor

只提取用户明确表达的硬边界。

例如：

```text
后端别动
```

→

```text
🔒 不修改后端
```

```text
不要删现有功能
```

→

```text
🔒 保留现有功能
```

```text
API 不要改
```

→

```text
🔒 保持现有 API 不变
```

```text
只分析原因，不要改代码
```

→

```text
🔒 只分析，不修改代码
```

```text
不要引入新的依赖
```

→

```text
🔒 不新增依赖
```

---

## 五、什么不要提取

以下内容 v0.2 一律不要自动升级成 Constraint：

```text
尽量简单一点
专业一点
最好快一点
别搞得太复杂
感觉后端最好别碰
尽可能漂亮
```

原因：

这些包含程度、偏好或主观判断。

Taskify 不应该把：

```text
尽量简单
```

变成：

```text
禁止新增依赖
```

也不要把：

```text
最好别碰
```

偷偷强化成：

```text
绝对禁止修改
```

核心原则：

> **Normalization 可以简化表达，但不能增强约束强度。**

---

## 六、v0.2 明确删除的旧思路

### 1. 删除 Prompt Rewriting

不再生成：

```text
目标
当前情况
需要处理
约束
验收标准
```

不再覆盖用户输入框。

### 2. 删除 LIGHT / STANDARD / DEEP

旧的“增强深度”概念不再有意义。

`depth.js` 可以在改造过程中删除。

### 3. 不做 PASS / PATCH / PLAN

v0.2 不需要任务分类器。

Taskify 不决定这个任务应该直接执行还是进入 Plan。

这些交给 Harness。

### 4. 不做 Route

Core 不需要知道：

```text
/plan
Goal
Subagent
Workflow
```

这些属于 DSH。

### 5. 不做 Goal 提取

Raw Prompt 已经包含目标。

不要再重复一次。

### 6. 不做 Repo Unknowns

不生成：

```text
需要确认 Dashboard 文件
需要确认 UI 技术栈
需要检查测试
```

现代 Coding Agent 本来就应该自己探索。

### 7. 暂时不做跨轮 Context Anchor

v0.2 MVP 只分析：

> **当前输入框里的用户消息。**

不自动从前几轮重新拾取约束。

### 8. 不做本地小模型

直接复用 DSH 当前模型完成 Constraint Extraction。

### 9. 暂时不做复杂 Local PASS

不写“出现路径 → PASS / 出现重构 → PLAN”这类规则。

---

## 七、保留 v0.1 已经做好的东西

以下是项目已有资产，不应该因为方向变化全部推翻：

- Literal Lock
- Slash Command 处理
- Cancel
- Undo 相关状态能力
- Revision / Race Protection
- stale response 丢弃
- Session 隔离
- 错误处理
- Host / Client 分层
- 当前模型复用
- 已有单元测试框架

其中部分逻辑可能因为“不再覆盖 Prompt”而变简单。

原则：

> **能复用就复用，不重写整个项目。**

---

## 八、Literal Lock 的新职责

Literal Lock 继续存在。

它至少保护当前用户输入里的：

- 代码
- 路径
- URL
- IP
- Port
- Version
- CLI
- Identifier

例如：

```text
不要修改 `src/auth/token.ts`
```

Taskify 不能输出：

```text
不要修改 `src/auth/tokens.ts`
```

---

## 九、Concrete Claim Guard 暂时轻量处理

不要在 v0.2 做复杂语义 Guard。

第一版只需要一个简单原则：

> Anchor 中不能凭空出现新的具体代码事实。

重点防：

- 新文件路径
- 新 CLI
- 新 URL
- 新版本号
- 明显的新代码标识符

不要尝试在 MVP 阶段判断复杂架构语义。

---

## 十、UI 改造

原来的：

```text
✨ 完善任务
```

可以继续暂时保留 Taskify 品牌，但建议弱化“完善”的含义。

例如：

```text
✨ Taskify
```

点击以后，原始输入保持完全不变。

输入框附近出现：

```text
🔒 后端不修改
🔒 保留现有功能
```

---

## 十一、Chips 第一版只读

不要允许：

- 编辑 Chip
- 删除 Chip

Raw Prompt 是唯一事实源。

如果用户认为 Anchor 不对，应修改 Raw Prompt 后重新运行 Taskify。

---

## 十二、Provenance 做成 UI 特性

Chip 可以 hover / 展开显示：

```text
🔒 后端不修改

来源：
“后端别动”
```

Taskify 从：

> “相信我，我理解了你。”

变成：

> **“这是我认为你明确表达过的边界，你可以检查来源。”**

---

## 十三、No-op 必须成立

例如：

```text
把 README 中的 foo 改成 bar。
```

允许：

```yaml
anchors: []
```

UI 显示：

```text
✓ 未发现需要额外锚定的约束
```

不要为了证明 Taskify 有用而制造内容。

---

## 十四、Warnings 暂缓或极度克制

例如：

```text
把没用的功能删掉。
```

如果未来实现 warning，可以显示：

```text
⚠️ “没用的功能”范围尚未定义
```

但：

- 不阻止发送
- 不自动追问
- 不自动修改 Prompt
- 不进入 Agent Contract

如果实现复杂，可延期到 v0.2.1。

---

## 十五、发送给 Agent 的内容

第一版保持简单。

原始用户内容：

```text
dashboard太乱了，帮我整理下，后端别动，功能也别删。
```

附加：

```text
<taskify_constraints>
- 不修改后端
- 保留现有功能
</taskify_constraints>
```

两者都属于 User-level information。

> **Taskify Contract 绝不提升为 System Prompt。**

---

## 十六、指令层级原则

必须保持：

```text
System
    ↓
Developer / Harness
    ↓
User
    ├─ Raw Prompt
    └─ Taskify Constraints
```

Taskify 只是在帮助表达 User Intent。

---

## 十七、v0.2 不做的大型 Eval 工程

作为个人 MVP，暂时不建设完整 Eval Framework。

不需要现在做：

- 100 条 benchmark
- 多 Harness
- 多模型
- 多次随机运行
- hidden test infrastructure
- 自动 Agent grading

---

## 十八、测试只做 MVP 必需部分

保留原有安全测试。

新增少量测试覆盖：

### Constraint extraction

```text
“后端别动”
→ 不修改后端
```

### No invented constraint

```text
“尽量简单”
≠ 禁止新增依赖
```

### Literal preservation

路径 / CLI / Version 不被修改。

### Empty Anchor

明确简单任务允许：

```text
anchors: []
```

### Provenance

Anchor 必须能够对应当前用户输入证据。

### No Prompt Rewrite

Taskify 不修改输入框正文。

### Race / Cancel

原有机制不能回归。

---

## 十九、先解决两个现实技术问题

正式开始 v0.2 前：

### 1. 修复 `pnpm-workspace.yaml`

当前：

```yaml
allowBuilds:
  esbuild: set this to true or false
```

需要修复。

### 2. 更新 DeepSeek Harness 兼容基线

当前 Taskify 仍基于旧的 rc.6。

先适配当前 DSH，再基于稳定 API 改 v0.2。

---

## 二十、建议开发顺序

### Phase 0 — Baseline

```text
pnpm 修复
+
DSH 当前版本兼容
+
现有测试通过
```

不要碰产品逻辑。

### Phase 1 — Extraction Contract

把旧 Compiler：

```text
Prompt → Better Prompt
```

改成：

```text
Prompt → Constraint Anchors
```

输出：

```text
anchors
+
evidence
```

### Phase 2 — UI

把：

```text
完善结果写回输入框
```

改成：

```text
Raw Prompt 保持原样
+
Read-only Chips
```

以及 No-op 状态。

### Phase 3 — Agent Injection

用户发送时：

```text
Raw Prompt
+
Taskify Constraint Contract
```

共同进入 DSH。

仍然由用户手动发送。

### Phase 4 — Cleanup

删除：

- `depth.js`
- LIGHT / STANDARD / DEEP
- Prompt Enhancer 文案
- 已失效测试
- 无效 Compiler 逻辑

更新：

- README
- demo
- 产品说明

---

## 二十一、v0.2 发布标准

### 工程上

- 可正常安装
- 当前 DSH 可运行
- 测试通过
- Literal 不被破坏
- 不自动发送
- 无 Race Regression
- 无明显新增 Repo Fact

### 产品上

用户能够清楚理解：

```text
我说了什么
↓
Taskify 锚定了什么
↓
为什么锚定
↓
原文没有被改变
```

做到这些，v0.2 就可以发布。

---

## 二十二、v0.2 明确不解决的问题

以下全部放以后：

```text
跨轮 Intent Memory
自动 Plan 推荐
Harness Routing
Goal
Subagent
Skill Routing
复杂 Human Clarification
本地 LLM
复杂 Semantic Claim Guard
完整 Eval Framework
多 Harness 支持
Editable Contract
Constraint History
```

如果项目后续真的有人用，再逐渐增加。

---

## 二十三、当前 v0.2 的核心哲学

> **Raw Prompt is the source of truth.**

> **Extract, don't invent.**

> **Every hard anchor needs provenance.**

> **No-op is a valid success.**

中文：

> **原始任务是唯一事实源。**

> **只提取，不创造。**

> **每个硬约束都必须有来源。**

> **什么都不需要补充也是成功。**

---

## 二十四、一句话产品定位

> **Taskify turns explicit user constraints into reviewable intent anchors before a coding agent executes the task.**

中文：

> **Taskify 在 Coding Agent 执行任务前，将用户明确表达的约束提取为可审阅的意图锚点。**

这已经足够作为一个个人 MVP 的 v0.2 产品方向。
