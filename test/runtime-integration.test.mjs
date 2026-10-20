import test from 'node:test'
import assert from 'node:assert/strict'
import { TypertRegistry } from '@deepseek-ai/dsh-typert-registry'
import { TaskifyService } from '../src/host/index.js'
import { TYPERT_DESCRIPTORS } from '../src/shared/schema.js'
import { loop, runtime } from './helpers/runtime.mjs'

test('rc.2 live Agent creation mounts Taskify context, isolates sessions, and tears down', async () => {
  new TypertRegistry(runtime)
  const service = new TaskifyService(runtime)
  const handle = await runtime.agents.create({ sessionId: 'taskify-live-first' })
  const first = handle.agent
  const second = await loop.create('taskify-live-second')
  assert.equal(service.contextRegistrations.get(first.id)?.agent, first)
  assert.equal(service.contextRegistrations.get(second.id)?.agent, second)
  assert.equal(service.typertRemote.service, service)
  assert.ok(runtime.typert.listPackages().some(record => record.package === 'dsh-taskify' || record.name === 'dsh-taskify'))

  const result = await service.setFocus({ sessionId: first.id, expectedRevision: 0, text: 'Only edit dashboard' })
  assert.equal(result.ok, true)
  const setFocus = TYPERT_DESCRIPTORS.find(item => item.method === 'setFocus')
  assert.deepEqual(setFocus.result.create().parse(result), result)
  assert.throws(() => setFocus.parameters[0].codec.create().parse({
    sessionId: first.id, expectedRevision: 0, text: 'Only edit dashboard', unexpected: true,
  }), /unknown|unexpected|unsupported/i)
  const getState = TYPERT_DESCRIPTORS.find(item => item.method === 'getState')
  const snapshot = await service.getState({ sessionId: first.id })
  assert.deepEqual(getState.result.create().parse(snapshot), snapshot)
  const one = await runtime.systemPrompt.assemble({ scope: first })
  const two = await runtime.systemPrompt.assemble({ scope: second })
  assert.match(JSON.stringify(one.contexts), /Only edit dashboard/)
  assert.doesNotMatch(JSON.stringify(two.contexts), /Only edit dashboard/)
  assert.equal(first.inbox.nextStep.length, 1)
  assert.equal(second.inbox.nextStep.length, 0)

  await handle.dispose()
  assert.equal(service.contextRegistrations.has(first.id), false)
  assert.equal(service.contextRegistrations.has(second.id), true)
})
