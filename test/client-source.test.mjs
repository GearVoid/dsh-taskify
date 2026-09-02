import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const source = await readFile(new URL('../src/client/index.jsx', import.meta.url), 'utf8')

test('client never rewrites or auto-submits the composer draft', () => {
  assert.equal(source.includes('inputActions.setDraft'), false)
  assert.equal(source.includes('inputActions.submit'), false)
  assert.equal(source.includes('onApply:'), false)
})

test('client mounts persistent lifecycle anchors in the official input dock', () => {
  assert.equal(source.includes("conversation.input.dock"), true)
  assert.equal(source.includes('TaskifyAnchors'), true)
  assert.equal(source.includes('来源：'), true)
  assert.equal(source.includes('未发现需要额外锚定的约束'), true)
  assert.equal(source.includes("'pauseAnchor' : 'resumeAnchor'"), true)
  assert.equal(source.includes("mutate('removeAnchor'"), true)
  assert.equal(source.includes('clearAnchors(taskifyRemote)'), true)
  assert.equal(source.includes('当前跨轮指导不可用'), true)
})

test('client previews armed anchors before send without lifecycle controls', () => {
  assert.equal(source.includes('taskifyAnchorDockModel(hostState, input?.draft)'), true)
  assert.equal(source.includes('Status: Pending activation'), true)
  assert.equal(source.includes('待发送激活'), true)
  assert.equal(source.includes("pending.map(({ key, anchor })"), true)
  assert.equal(source.includes("persistent.map(({ key, anchor })"), true)
})

test('client hydrates and invalidates through revisioned Host snapshots', () => {
  assert.equal(source.includes('controller.hydrate(taskifyRemote)'), true)
  assert.equal(source.includes('previousPhaseRef.current !== phase'), true)
  assert.equal(source.includes('const running = useSession(s => s.running)'), true)
  assert.equal(source.includes('previousRunningRef.current === true && running === false'), true)
  assert.equal(source.includes('if (turnSettled && controller && taskifyRemote)'), true)
  assert.equal(source.includes('if (phaseChanged && controller && taskifyRemote)'), false)
  assert.equal(source.includes("if (phase !== 'plain' || suppressDraftInvalidationRef.current) return"), true)
  assert.equal(source.includes('suppressDraftInvalidationRef.current'), true)
  assert.equal(source.includes('controller.invalidate(taskifyRemote)'), true)
  assert.equal(source.includes('const hostState = state?.hostState'), true)
  assert.equal(source.includes('invalidateRemote('), false)
})
