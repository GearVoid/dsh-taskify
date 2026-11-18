import { after } from 'node:test'
import { createRequire } from 'node:module'
import { pathToFileURL } from 'node:url'
import { Context, symbols } from '@deepseek-ai/cordis'
import { AgentRegistry } from '@deepseek-ai/dsh-agent'
import { AgentLoop } from '@deepseek-ai/dsh-agent-loop'

const require = createRequire(import.meta.resolve('@deepseek-ai/dsh-agent-loop'))
const peer = name => import(pathToFileURL(require.resolve(`@deepseek-ai/dsh-${name}`)).href)
const { SessionStore, SessionId } = await peer('session')
const { SessionProjectionRegistry } = await peer('session-projection')
const { SystemPrompt } = await peer('system-prompt')

// Services register projections in their Cordis init hook, which only a fiber runs.
// Run the same hook by hand: the harness constructs services directly instead of
// loading the whole plugin graph that would satisfy their `inject` lists.
async function initializeService(instance) {
  for (const hook of instance?.[symbols.initHooks] ?? []) hook()
  await instance?.[symbols.init]?.()
  return instance
}

// Exercise the published 0.2.2 loop, which owns Inbox and its projection.
export const runtime = new Context()
new SessionStore(runtime)
new SessionProjectionRegistry(runtime)
await initializeService(new AgentRegistry(runtime))
new SystemPrompt(runtime, { includeHarnessIdentity: false, includeRuntimeContext: true })
export const loop = await initializeService(new AgentLoop(runtime, { agents: [], maxParallelToolCalls: 1 }))
const agent = await loop.create(SessionId('taskify-inbox-constructor'))
const RuntimeInbox = agent.inbox.constructor
after(() => runtime.fiber.dispose())

// Test-only adapter for existing replay fixtures; no copied Inbox implementation.
export class Inbox {
  constructor(session, handlers) {
    const readState = loop.inboxProjectionHandle.readerFor(session)
    return new RuntimeInbox(readState, session, {
      emit(event, payload) { handlers[event.split('/').at(-1)]?.(payload?.message) },
    })
  }
}
