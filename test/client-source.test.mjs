import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const source = await readFile(new URL('../src/client/index.jsx', import.meta.url), 'utf8')
const generated = await readFile(new URL('../client.js', import.meta.url), 'utf8')

test('client never rewrites or auto-submits the composer draft', () => {
  assert.equal(source.includes('inputActions.setDraft'), false)
  assert.equal(source.includes('inputActions.submit'), false)
  assert.equal(source.includes('onApply:'), false)
})

test('client mounts persistent lifecycle anchors in the official input dock', () => {
  assert.equal(source.includes("conversation.input.dock"), true)
  assert.equal(source.includes('TaskifyAnchors'), true)
  assert.equal(source.includes('dsh-taskify-focus-layer'), true)
  assert.equal(source.includes('dsh-taskify-anchor-layer'), true)
  assert.ok(source.indexOf('dsh-taskify-focus-layer') < source.indexOf('dsh-taskify-anchor-layer'))
  assert.equal(source.includes('未发现需要额外锚定的约束'), true)
  assert.equal(source.includes("'pauseAnchor' : 'resumeAnchor'"), true)
  assert.equal(source.includes("mutate('removeAnchor'"), true)
  assert.equal(source.includes('clearAnchors(taskifyRemote)'), true)
  assert.equal(source.includes('当前跨轮指导不可用'), true)
})

test('client mounts minimal user-owned Focus controls before Anchor chips', () => {
  assert.equal(source.includes('🎯 设置 Focus'), true)
  assert.equal(source.includes('controller.setFocus(focusDraft, taskifyRemote)'), true)
  assert.equal(source.includes('controller.editFocus(focusDraft, taskifyRemote)'), true)
  assert.equal(source.includes("'pauseFocus' : 'resumeFocus'"), true)
  assert.equal(source.includes('clearFocus(taskifyRemote)'), true)
  assert.ok(source.indexOf('editingFocus ?') < source.indexOf('persistent.map'))
})

test('client renders an editable and dismissible Focus suggestion without auto-activation', () => {
  assert.equal(source.includes('🎯 建议 Focus: {suggestion}'), true)
  assert.equal(source.includes('controller.acceptFocusSuggestion(text, taskifyRemote)'), true)
  assert.equal(source.includes('controller?.ignoreFocusSuggestion()'), true)
  assert.equal(source.includes('onClick={editSuggestion}'), true)
  assert.equal(source.includes('编辑建议 Focus'), true)
  assert.equal(source.includes('autoSetFocus'), false)
})

test('Focus suggestion text truncates before its single-line actions can shrink', () => {
  const suggestionRule = source.match(/\.dsh-taskify-focus-suggestion \{([^}]*)\}/u)?.[1] ?? ''
  const textRule = source.match(/\.dsh-taskify-focus-suggestion-text \{([^}]*)\}/u)?.[1] ?? ''
  const actionsRule = source.match(/\.dsh-taskify-focus-suggestion-actions \{([^}]*)\}/u)?.[1] ?? ''
  assert.match(suggestionRule, /width:\s*fit-content/u)
  assert.match(textRule, /flex:\s*0 1 auto/u)
  assert.match(textRule, /min-width:\s*0/u)
  assert.match(textRule, /overflow:\s*hidden/u)
  assert.match(textRule, /text-overflow:\s*ellipsis/u)
  assert.match(textRule, /white-space:\s*nowrap/u)
  assert.match(actionsRule, /flex-shrink:\s*0/u)
  assert.match(actionsRule, /flex-wrap:\s*nowrap/u)
  assert.match(actionsRule, /white-space:\s*nowrap/u)
  assert.equal(source.includes('border-inline-start'), false)
})

test('Clear All stays beside the Anchor group with secondary action typography', () => {
  const clearRule = source.match(/\.dsh-taskify-clear \{([^}]*)\}/gu)?.at(-1) ?? ''
  assert.match(clearRule, /font-size:\s*12px/u)
  assert.match(clearRule, /font-weight:\s*400/u)
  assert.ok(source.indexOf('dsh-taskify-pending-status') < source.indexOf('dsh-taskify-clear'))
  assert.equal(source.includes('dsh-taskify-anchor-meta'), false)
})

test('client exposes pending Focus acceptance and applies it only after turn-settle hydration', () => {
  assert.equal(source.includes("'待发送后启用'"), true)
  assert.equal(source.includes('启用失败：${pendingAcceptance.error}'), true)
  assert.equal(source.includes('retryPendingFocusAcceptance(taskifyRemote)'), true)
  assert.equal(source.includes('applyPendingFocus: true'), true)
})

test('client previews armed anchors before send without lifecycle controls', () => {
  assert.equal(source.includes('taskifyAnchorDockModel(hostState, input?.draft)'), true)
  assert.equal(source.match(/>· 待发送</gu)?.length, 1)
  assert.equal(source.includes('待发送激活'), false)
  assert.equal(source.includes("pending.map(({ key, anchor })"), true)
  assert.equal(source.includes("persistent.map(({ key, anchor })"), true)
})

test('client provenance is user-facing and excludes internal state labels', () => {
  assert.equal(source.includes('anchorProvenanceForDisplay(anchor)'), true)
  assert.equal(source.includes('provenance.title'), true)
  assert.equal(source.includes('provenance.evidence'), true)
  assert.equal(source.includes('Scope: Session'), false)
  assert.equal(source.includes('Status: Active'), false)
  assert.equal(source.includes('Status: Pending activation'), false)
})

test('generated client contains the polished source structure', () => {
  assert.equal(generated.includes('dsh-taskify-focus-layer'), true)
  assert.equal(generated.includes('dsh-taskify-anchor-layer'), true)
  assert.equal(generated.includes('anchorProvenanceForDisplay(anchor)'), true)
  assert.equal(generated.includes('provenance.evidence'), true)
  assert.equal(generated.includes('Scope: Session'), false)
  assert.equal(generated.includes('Status: Active'), false)
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
