export type Limit = { percent: number; resetsAt?: string }

export type Usage = {
  model: string
  context?: number
  fiveHour?: Limit
  sevenDay?: Limit
  today?: { tokens: number; cost: number }
}

declare module 'claude-code' {
  interface PluginState {
    'usageboard': { usage: Usage }
  }
}
