import test from 'node:test'
import assert from 'node:assert/strict'
import {
  MAX_RESULT_CHARS,
  lockLiterals,
  makeSentinel,
  validateAndUnlock,
  validateLockedResult,
} from '../src/shared/literal-lock.js'

function locked(draft) {
  return lockLiterals(draft)
}

function roundtrip(draft, expected) {
  const lock = locked(draft)
  assert.equal(lock.locks.length > 0, true, `expected literals in: ${draft}`)
  const validated = validateAndUnlock(lock.text, lock)
  assert.equal(validated.ok, true, validated.error)
  assert.equal(validated.text, expected ?? draft)
}

test('T04: inline code identifiers survive byte-for-byte', () => {
  const draft = '把 `UserPromptSubmit` 调整一下，但不要修改 `updatedInput`'
  roundtrip(draft)
})

test('T05: paths and URLs survive byte-for-byte', () => {
  const draft = '修一下 src/app.ts，参考 https://example.com/api 的配置'
  roundtrip(draft)
})

test('Windows paths survive byte-for-byte', () => {
  const bs = String.fromCharCode(92)
  const draft = `检查 C:${bs}Users${bs}Test 与 ./config.json 和 ../src`
  roundtrip(draft)
})

test('common path forms are locked as complete spans', () => {
  const paths = [
    '/etc/passwd',
    '/usr/local/bin/node',
    '/var/log/app.log',
    '/tmp/.env',
    '/home/user/project/',
    '~/project/config.json',
    './config.json',
    '../src/index.ts',
    'src/app.ts',
    'C:\\Users\\Test\\file.txt',
    'C:/Users/Test/file.txt',
    '\\\\server\\share\\folder\\file.txt',
    '/opt/My App/config.json',
    'C:\\Program Files\\App\\app.exe',
  ]

  for (const path of paths) {
    const quoted = path.includes(' ') ? `"${path}"` : path
    const lock = locked(`检查 ${quoted}，不要修改`)
    assert.equal(lock.locks.includes(path), true, `expected complete path lock: ${path}`)
    assert.equal(validateAndUnlock(lock.text, lock).text, `检查 ${quoted}，不要修改`)
  }
})

test('absolute POSIX path suffix cannot be rewritten outside the lock', () => {
  const lock = locked('/etc/passwd')
  assert.deepEqual(lock.locks, ['/etc/passwd'])
  assert.equal(lock.text.includes('/passwd'), false)
  const validation = validateLockedResult('/etc/shadow', lock)
  assert.equal(validation.ok, false)
  assert.equal(validation.error, 'SENTINEL_MISSING')
})

test('code fences are locked as one whole span', () => {
  const draft = '看一下这段\n```ts\nconst x = { a: 1 }\n```\n不要动'
  const lock = locked(draft)
  assert.equal(lock.locks.includes('```ts\nconst x = { a: 1 }\n```'), true)
  const validated = validateAndUnlock(lock.text, lock)
  assert.equal(validated.ok, true)
  assert.equal(validated.text, draft)
})

test('env vars, versions, flags, ports and identifiers survive', () => {
  const draft = '设置 NODE_ENV=production，版本 0.1.0-rc.6，运行 --force，使用 Node 24，端口 8080'
  roundtrip(draft)
})

test('lower-camel and dotted identifiers survive', () => {
  const draft = 'inputActions.setDraft() 与 conversation.input.right 保持不变'
  roundtrip(draft)
})

test('sentinel nonce never collides with user text', () => {
  const nonce = 'AAAAAAAA'
  const draft = `原文 __DSH_TASKIFY_${nonce}_LOCK_000__ 后面`
  const lock = locked(draft)
  assert.notEqual(lock.nonce, nonce)
})

test('T14: missing sentinel is rejected', () => {
  const lock = locked('修复 src/app.ts 的空指针')
  const result = '修复这个文件的问题'
  const validation = validateLockedResult(result, lock)
  assert.equal(validation.ok, false)
  assert.equal(validation.error, 'SENTINEL_MISSING')
})

test('duplicated sentinel is rejected', () => {
  const lock = locked('src/app.ts')
  const sentinel = makeSentinel(lock.nonce, 0)
  const validation = validateLockedResult(`${sentinel} ${sentinel}`, lock)
  assert.equal(validation.ok, false)
  assert.equal(validation.error, 'SENTINEL_DUPLICATED')
})

test('reordered sentinels are rejected', () => {
  const lock = locked('src/app.ts 与 packages/ui/index.tsx')
  assert.equal(lock.locks.length >= 2, true)
  const result = `${makeSentinel(lock.nonce, 1)} ${makeSentinel(lock.nonce, 0)}`
  const validation = validateLockedResult(result, lock)
  assert.equal(validation.ok, false)
  assert.equal(validation.error, 'SENTINEL_ORDER_CHANGED')
})

test('invented sentinel is rejected', () => {
  const lock = locked('普通文本')
  const validation = validateLockedResult(`前缀 ${makeSentinel('BBBBBBBB', 0)}`, lock)
  assert.equal(validation.ok, false)
  assert.equal(validation.error, 'UNKNOWN_SENTINEL')
})

test('empty and oversized results are rejected', () => {
  const lock = locked('普通文本')
  assert.equal(validateLockedResult('   ', lock).ok, false)
  assert.equal(validateLockedResult('x'.repeat(MAX_RESULT_CHARS + 1), lock).ok, false)
})
