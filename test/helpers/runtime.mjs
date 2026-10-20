import { after } from 'node:test'
import { createRequire } from 'node:module'
import { pathToFileURL } from 'node:url'
import { Context } from '@deepseek-ai/cordis'
import { AgentRegistry } from '@deepseek-ai/dsh-agent'
import { AgentLoop } from '@deepseek-ai/dsh-agent-loop'

const require = createRequire(import.meta.resolve('@deepseek-ai/dsh-agent-loop'))
const peer = name => import(pathToFileURL(require.resolve(`@deepseek-ai/dsh-${name}`)).href)
const { SessionStore, SessionId } = await peer('session')
const { SessionProjectionRegistry } = await peer('session-projection')
const { SystemPrompt } = await peer('system-prompt')

// Exercise the published rc.2 loop, which now owns Inbox and its projection.
export const runtime = new Context()
new SessionStore(runtime)
new SessionProjectionRegistry(runtime)
new AgentRegistry(runtime)
new SystemPrompt(runtime, { includeHarnessIdentity: false, includeRuntimeContext: true })
export const loop = new AgentLoop(runtime, { agents: [], maxParallelToolCalls: 1 })
const agent = await loop.create(SessionId('taskify-inbox-constructor'))
const RuntimeInbox = agent.inbox.constructor
after(() => runtime.fiber.dispose())

// Test-only adapter for existing replay fixtures; no copied Inbox implementation.
export class Inbox {
  constructor(session, handlers) {
    return new RuntimeInbox(runtime.sessionProjections, session, {
      emit(event, { message }) { handlers[event.split('/').at(-1)]?.(message) },
    })
  }
}
