import { atom, read, update } from 'claude-code'
import type { Register } from 'claude-code'

import type { Applied, Effort, Pick, Pin } from '../types'

// Jev picks the effort of each message, called straight from the mod.
// The model is never switched: a model change throws away the prompt cache,
// an effort change keeps it on Opus/Sonnet/Haiku 5.5 with a subscription.
const ENDPOINT = 'https://openrouter.ai/api/alpha/decisions'
const MODEL = 'typesafe/jev-1.13'
const KEYCHAIN_SERVICE = 'openrouter-jev' // macOS fallback when no key is set in the plugin's options
const THRESHOLD = 0.6 // Jev confidence needed to act on its pick
const WAIT_MS = 3000  // the first request of a turn waits this long for Jev at most

const EFFORT_OPTIONS: Record<Effort, string> = {
  low: 'Trivial or mechanical task; little thinking needed.',
  medium: 'Typical task with a few steps.',
  high: 'Complex task that needs careful reasoning and double-checking.',
}

const pick = atom({ plugin: 'jev-router', key: 'pick' } as const, null)
const pin = atom({ plugin: 'jev-router', key: 'pin' } as const, {})
const auto = atom({ plugin: 'jev-router', key: 'auto' } as const, true)
const applied = atom({ plugin: 'jev-router', key: 'applied' } as const, null)
const LABEL_GRACE_MS = 10000 // a reply first drawn this long after its turn still gets labelled

const EFFORTS: Effort[] = ['low', 'medium', 'high']
const pct = (x: number) => `${Math.round(x * 100)}%`

export const register: Register = (on, options) => {
  // The key is read once per load and never shown; '' means Jev stays off.
  let key: Promise<string> | null = null
  const apiKey = (run: (argv: string[]) => Promise<{ exitCode: number; stdout: string }>) => {
    key ??= (async () => {
      const set = options.openrouterKey
      if (typeof set === 'string' && set.trim()) {
        return set.trim()
      }
      try {
        const r = await run(['/usr/bin/security', 'find-generic-password', '-s', KEYCHAIN_SERVICE, '-w'])
        return r.exitCode === 0 ? r.stdout.trim() : ''
      } catch {
        return ''
      }
    })()
    return key
  }

  // The Jev call for the message being sent; the turn's first request awaits it.
  let pending: Promise<Pick | null> | null = null
  // Labelling window: replies first drawn while a turn runs (or just after) get its effort.
  // Starts closed, so a reload never labels older replies with today's effort.
  let turnEffort: string | null = null
  let labelUntil = 0
  const labels = new Map<string, string>() // reply's first message id -> effort label

  on('prompt.submit', ($, e, next) => {
    if (e.command || e.isMeta || e.turnId || e.text.trim().length < 8) {
      return next(e)
    }
    pending = (async () => {
      try {
        const k = await apiKey(argv => $.process.run(argv, { timeoutMs: WAIT_MS }))
        if (!k) {
          return null
        }
        const t0 = await $.clock.now()
        const res = await $.http.fetch(ENDPOINT, {
          method: 'POST',
          headers: { Authorization: `Bearer ${k}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            model: MODEL,
            state: { task: e.text.slice(0, 4000) },
            questions: {
              effort: {
                type: 'choice',
                criteria: EFFORT_OPTIONS,
                instructions: 'How much reasoning effort does `task` need?',
              },
            },
          }),
        })
        if (!res.ok) {
          return null
        }
        const a = JSON.parse(res.text)?.answers?.effort
        if (!a || !(a.choice in EFFORT_OPTIONS)) {
          return null
        }
        const p: Pick = { effort: a.choice as Effort, effortConf: Number(a.confidence ?? 0), ms: (await $.clock.now()) - t0 }
        await update($, pick, () => p)
        return p
      } catch {
        return null
      }
    })()

    return next(e)
  })

  on('turn.step', async function* ($, e, next) {
    if (e.agentId) {
      return yield* next(e)
    }
    if (pending) {
      await Promise.race([pending, $.clock.sleep(WAIT_MS)])
      pending = null
    }
    const p = await read($, pick)
    const pinned = await read($, pin)
    const isAuto = await read($, auto)
    let effort = e.effort
    if (pinned.effort) {
      effort = pinned.effort
    } else if (isAuto && p && p.effortConf >= THRESHOLD) {
      effort = p.effort
    }
    const now: Applied = { model: e.model, effort: effort === undefined ? undefined : String(effort) }
    await update($, applied, () => now)
    turnEffort = now.effort ?? 'réglage de l\'app'
    labelUntil = Number.POSITIVE_INFINITY

    return yield* next({ ...e, effort })
  })

  on('turn.complete', async ($, e, next) => {
    if (!e.agentId) {
      labelUntil = (await $.clock.now()) + LABEL_GRACE_MS
    }
    return next(e)
  })

  on('ui.render', { component: 'AssistantMessage' }, async ($, e, next) => {
    if (!e.props.isFirstOfReply) {
      return next(e)
    }
    // Drawing is pure: $.state can't be written here, so labels live in this module's memory
    // (a reload forgets them, and older replies then stay unlabelled).
    let label = labels.get(e.requestId)
    if (label === undefined) {
      // '' marks a reply first seen outside a turn: never labelled later, even when redrawn mid-turn.
      const isOpen = turnEffort !== null && (await $.clock.now()) < labelUntil
      label = isOpen ? (turnEffort as string) : ''
      labels.set(e.requestId, label)
    }
    const base = await next(e)
    if (!label) {
      return base
    }
    const { Box, Text } = $.ui.resolve(e)

    return (
      <Box flexDirection="column">
        {base}
        <Text dimColor size="caption">{`effort : ${label}`}</Text>
      </Box>
    )
  })

  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    const p = await read($, pick)
    if (e.props.hasSurvey || p === null) {
      return next(e)
    }
    const pinned = await read($, pin)
    const isAuto = await read($, auto)
    const ran = await read($, applied)
    const { Box, Button, Text } = $.ui.resolve(e)

    const setPin = (change: Pin) => update($, pin, old => ({ ...old, ...change }))
    const isSure = p.effortConf >= THRESHOLD

    return (
      <Box flexDirection="row" flexWrap="wrap" gap={1}>
        <Text>
          {'Jev : '}<Text weight="bold">{p.effort}</Text>
          <Text dimColor>{` ${pct(p.effortConf)}${isSure ? '' : ' (pas sûr)'}`}</Text>
        </Text>
        {ran ? <Text dimColor>{`· utilisé : ${ran.effort ?? 'app'}`}</Text> : null}
        {EFFORTS.map(x => (
          <Button
            key={`effort-${x}`}
            label={pinned.effort === x ? `[${x}]` : x}
            onPress={() => setPin({ effort: pinned.effort === x ? undefined : x })}
          />
        ))}
        <Button
          key="auto"
          label={isAuto ? 'Auto : on' : 'Auto : off'}
          onPress={() => update($, auto, v => !v)}
        />
        {pinned.effort ? (
          <Button key="unpin" label="Désépingler" onPress={() => update($, pin, () => ({}))} />
        ) : null}
      </Box>
    )
  })
}
