import { expect, test } from 'claude-code/testing'

test('each main-loop turn writes one decision line', { options: { openrouterKey: 'k' } }, async ($, on) => {
  const files = new Map<string, string>()
  on('http.fetch', () => ({
    value: { ok: true, status: 200, text: JSON.stringify({ answers: { effort: { choice: 'high', confidence: 0.9 } } }) },
  }))
  on('env.get', () => ({ value: '/home/test' }))
  on('session.id', () => ({ value: 's1' }))
  on('fs.exists', (_, e) => ({ value: files.has(e.path) }))
  on('fs.read', (_, e) => ({ value: files.get(e.path) ?? '' }))
  on('fs.write', (_, e) => {
    files.set(e.path, e.text)
    return { value: undefined }
  })
  on('prompt.submit', (_, e) => ({ text: e.text }))
  on('turn.step', async function* (_, e) {
    return { turnId: e.turnId, index: e.index, answer: 'ok', toolUses: [], stopReason: 'end_turn', usage: null, effort: e.effort }
  })
  on('turn.complete', (_, e) => ({ text: e.answer }))
  on('clock.now', () => ({ value: Date.UTC(2026, 10, 3) }))
  on('clock.sleep', () => new Promise(() => {})) // Jev always answers before the wait ends

  await $.prompt.submit({ text: 'Refactor the whole auth layer please' })
  const stream = $.turn.step({ turnId: 't1', index: 0, model: 'claude-opus-5-5', effort: 'medium' })
  for await (const _ of stream) {
    // drain
  }
  await $.turn.complete({
    turnId: 't1',
    answer: 'ok',
    durationMs: 1200,
    isAborted: false,
    reason: 'completed',
    usage: { model: 'claude-opus-5-5', input_tokens: 10, output_tokens: 500, cache_read_input_tokens: 90, cache_creation_input_tokens: 0 },
  })

  const [path, text] = [...files][0]
  expect(path).toMatch(/^\/home\/test\/\.claude\/jev-router\/decisions\/\d{4}-\d{2}\/s1\.jsonl$/)
  const line = JSON.parse(text.trim())
  expect(line.jev.effort).toBe('high')
  expect(line.appEffort).toBe('medium')
  expect(line.effort).toBe('high')
  expect(line.outputTokens).toBe(500)
  expect(line.inputTokens).toBe(100)
  expect(line.prompt).toBe('Refactor the whole auth layer please')
})
