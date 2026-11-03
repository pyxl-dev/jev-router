export type Effort = 'low' | 'medium' | 'high'

/** What Jev answered for the last message. */
export type Pick = {
  effort: Effort
  effortConf: number
  ms: number
}

/** What the person pinned with the band's buttons; wins over Jev until cleared. */
export type Pin = { effort?: Effort }

/** What the last main-loop request actually ran with. */
export type Applied = { model: string; effort?: string }

/** One line of the decision log: what Jev said, what ran, and what the turn cost. */
export type LogEntry = {
  at: string
  prompt: string
  jev: Pick | null
  pinned: Effort | null
  auto: boolean
  appEffort: string | null
  effort: string | null
  model?: string | null
  outputTokens?: number | null
  inputTokens?: number | null
  durationMs?: number
  aborted?: boolean
}

declare module 'claude-code' {
  interface PluginState {
    'jev-router': {
      pick: Pick | null
      pin: Pin
      auto: boolean
      applied: Applied | null
    }
  }
}
