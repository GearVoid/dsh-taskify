import test from 'node:test'
import assert from 'node:assert/strict'
import { TaskifyService } from '../src/host/index.js'
import { renderTaskifyRuntimeContext } from '../src/shared/lifecycle.js'
import { TaskifyStateProjection } from '../src/shared/state.js'

function activateProjection(projection, sessionId, text = '不修改后端') {
  const pending = projection.update(sessionId, projection.getState(sessionId).revision, {
    type: 'begin-compile', requestId: `request-${sessionId}`, boundDraft: '后端别动', sourceDraft: '后端别动',
  })
  const armed = projection.update(sessionId, pending.state.revision, {
    type: 'arm', requestId: `request-${sessionId}`,
    anchors: [{ text, evidence: '后端别动' }],
    carrier: { messageId: `message-${sessionId}`, bundleId: `bundle-${sessionId}`, requestId: `request-${sessionId}` },
  })
  return projection.update(sessionId, armed.state.revision, {
    type: 'activate', requestId: `request-${sessionId}`, bundleId: `bundle-${sessionId}`,
  }).state
}

function serviceFixture() {
  const providers = new Map()
  const disposed = []
  const agents = new Map()
  const service = {
    stateProjection: new TaskifyStateProjection(),
    dirtySessions: new Set(),
    contextRegistrations: new Map(),
    contextSuppressions: new Map(),
    ctx: { agents: { get(id) { return agents.get(id) } }, sessions: { get() {} } },
    refreshState: TaskifyService.prototype.refreshState,
  }
  const agent = sessionId => {
    const value = {
      id: sessionId,
      ctx: {
        systemPrompt: {
          context(provider) {
            if (providers.has(sessionId)) throw new Error('duplicate registration')
            providers.set(sessionId, provider)
            return () => { providers.delete(sessionId); disposed.push(sessionId) }
          },
        },
      },
    }
    agents.set(sessionId, value)
    return value
  }
  return { service, providers, disposed, agent }
}

test('runtime context renders active anchors with revision for second and third steps', () => {
  const fx = serviceFixture()
  const agent = fx.agent('s1')
  assert.equal(TaskifyService.prototype.installRuntimeContext.call(fx.service, agent), true)
  const active = activateProjection(fx.service.stateProjection, 's1')
  const provider = fx.providers.get('s1')
  const second = provider.text()
  const third = provider.text()
  assert.equal(second, third)
  assert.match(second, new RegExp(`revision="${active.revision}"`))
  assert.match(second, /不修改后端/)
  assert.match(second, /supersede earlier/)
})

test('paused anchors are excluded and clear emits an explicit superseding empty state', () => {
  const fx = serviceFixture()
  const agent = fx.agent('s1')
  TaskifyService.prototype.installRuntimeContext.call(fx.service, agent)
  const active = activateProjection(fx.service.stateProjection, 's1')
  const paused = fx.service.stateProjection.update('s1', active.revision, {
    type: 'replace-anchors', anchors: active.anchors.map(anchor => ({ ...anchor, status: 'paused' })),
  }).state
  const pausedText = fx.providers.get('s1').text()
  assert.doesNotMatch(pausedText, /不修改后端/)
  assert.match(pausedText, /No Taskify constraints are currently active/)
  const cleared = fx.service.stateProjection.update('s1', paused.revision, { type: 'replace-anchors', anchors: [] }).state
  const clearText = fx.providers.get('s1').text()
  assert.match(clearText, new RegExp(`revision="${cleared.revision}"`))
  assert.match(clearText, /Earlier Taskify constraint notices are superseded/)
})

test('runtime provider registration is idempotent and first activation context can be suppressed once', () => {
  const fx = serviceFixture()
  const agent = fx.agent('s1')
  assert.equal(TaskifyService.prototype.installRuntimeContext.call(fx.service, agent), true)
  assert.equal(TaskifyService.prototype.installRuntimeContext.call(fx.service, agent), true)
  assert.equal(fx.providers.size, 1)
  activateProjection(fx.service.stateProjection, 's1')
  fx.service.contextSuppressions.set('s1', [{ text: '不修改后端', evidence: '后端别动' }])
  assert.equal(fx.providers.get('s1').text(), '')
  assert.match(fx.providers.get('s1').text(), /不修改后端/)
  assert.equal(TaskifyService.prototype.uninstallRuntimeContext.call(fx.service, agent), true)
  assert.deepEqual(fx.disposed, ['s1'])
  assert.equal(fx.service.stateProjection.getState('s1').runtimeContext.available, false)
})

test('first-turn suppression removes only carrier duplicates and preserves older active anchors', () => {
  const fx = serviceFixture()
  const agent = fx.agent('s1')
  TaskifyService.prototype.installRuntimeContext.call(fx.service, agent)
  const first = activateProjection(fx.service.stateProjection, 's1', '既有约束')
  const pending = fx.service.stateProjection.update('s1', first.revision, {
    type: 'begin-compile', requestId: 'request-next', boundDraft: '新增约束', sourceDraft: '新增约束',
  })
  fx.service.stateProjection.update('s1', pending.state.revision, {
    type: 'arm', requestId: 'request-next', anchors: [{ text: '新增约束', evidence: '新增约束' }],
    carrier: { messageId: 'message-next', bundleId: 'bundle-next', requestId: 'request-next' },
  })

  const beforePreStep = fx.providers.get('s1').text()
  assert.match(beforePreStep, /既有约束/)
  assert.doesNotMatch(beforePreStep, /新增约束/)

  const armed = fx.service.stateProjection.getState('s1')
  const activated = fx.service.stateProjection.update('s1', armed.revision, {
    type: 'activate', requestId: 'request-next', bundleId: 'bundle-next',
  }).state
  fx.service.contextSuppressions.set('s1', armed.request.bundle.anchors)
  const afterPreStep = fx.providers.get('s1').text()
  assert.match(afterPreStep, /既有约束/)
  assert.doesNotMatch(afterPreStep, /新增约束/)
  assert.match(fx.providers.get('s1').text(), new RegExp(`revision="${activated.revision}"`))
  assert.match(fx.providers.get('s1').text(), /新增约束/)
})

test('runtime providers are exact-session isolated and unavailable registration is visible', () => {
  const fx = serviceFixture()
  const a = fx.agent('a')
  const b = fx.agent('b')
  TaskifyService.prototype.installRuntimeContext.call(fx.service, a)
  TaskifyService.prototype.installRuntimeContext.call(fx.service, b)
  activateProjection(fx.service.stateProjection, 'a', 'A constraint')
  activateProjection(fx.service.stateProjection, 'b', 'B constraint')
  assert.match(fx.providers.get('a').text(), /A constraint/)
  assert.doesNotMatch(fx.providers.get('a').text(), /B constraint/)
  assert.match(fx.providers.get('b').text(), /B constraint/)

  const unavailable = { id: 'missing', ctx: {} }
  assert.equal(TaskifyService.prototype.installRuntimeContext.call(fx.service, unavailable), false)
  assert.equal(fx.service.stateProjection.getState('missing').runtimeContext.available, false)
})

test('empty context renderer is safe even before any activation', () => {
  const state = new TaskifyStateProjection().getState('empty')
  const text = renderTaskifyRuntimeContext(state)
  assert.match(text, /revision="0"/)
  assert.match(text, /No Taskify constraints are currently active/)
})

test('runtime renders active Focus beside Anchors with exactly three generic policy rules', () => {
  const projection = new TaskifyStateProjection()
  const focused = projection.update('s', 0, {
    type: 'replace-focus',
    focus: { text: '只完成 Focus v0.4', status: 'active', scope: { kind: 'session', sessionId: 's' } },
  }).state
  const active = activateProjection(projection, 's')
  const rendered = renderTaskifyRuntimeContext(active)
  assert.match(rendered, /只完成 Focus v0\.4/)
  assert.match(rendered, /不修改后端/)
  const policy = rendered.split('Focus policy:\n')[1].split('\n\n')[0].split('\n')
  assert.equal(policy.length, 3)
  assert.deepEqual(active.focus, focused.focus)
  assert.doesNotMatch(rendered, /refactor|fallback|dependency/i)
})
