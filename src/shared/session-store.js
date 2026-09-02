import { TaskifySession } from './task-runner.js'

// Disposable browser controllers. Their hostState field is only a Remote snapshot
// cache; deleting this Map never mutates authoritative Host domain state.
const sessions = new Map()

export function taskifySessionFor(sessionId) {
  if (typeof sessionId !== 'string' || sessionId === '') return null
  let session = sessions.get(sessionId)
  if (!session) {
    session = new TaskifySession(sessionId)
    sessions.set(sessionId, session)
  }
  return session
}

export function releaseTaskifySession(sessionId) {
  if (typeof sessionId !== 'string') return
  const session = sessions.get(sessionId)
  if (!session) return
  session.destroy()
  sessions.delete(sessionId)
}

export function subscribeTaskifySession(sessionId, listener) {
  const session = taskifySessionFor(sessionId)
  if (!session) return () => {}
  return session.subscribe(listener)
}

export function getTaskifySnapshot(sessionId) {
  return taskifySessionFor(sessionId)?.getSnapshot() ?? null
}

export function taskifySessionCount() {
  return sessions.size
}

export function resetTaskifySessions() {
  for (const session of sessions.values()) session.destroy()
  sessions.clear()
}
