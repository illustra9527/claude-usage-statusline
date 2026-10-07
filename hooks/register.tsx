import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register } from 'claude-code'

import type { Limit, Usage } from '../types'
import { SEP, formatTokens, gauge, modelName, resetIn } from './format'

// How often to rescan today's transcripts while the session is idle.
const TODAY_REFRESH_MS = 60_000

const usage = atom({ plugin: 'usageboard', key: 'usage' } as const, { model: '' } as Usage)

function limitOf(kind: string, limits: { kind: string; percentUsed: number; resetsAt?: string }[]): Limit | undefined {
  const l = limits.find(x => x.kind === kind)
  return l ? { percent: l.percentUsed, resetsAt: l.resetsAt } : undefined
}

async function measure($: EngineInterface) {
  const u = await $.session.usage()
  const model = modelName(await $.session.model())
  await update($, usage, prev => ({
    ...prev,
    model,
    context: u.context.percent,
    fiveHour: limitOf('five_hour', u.rateLimits),
    sevenDay: limitOf('seven_day', u.rateLimits),
  }))
}

// Today's totals come from statusline.js, which reads every session's transcripts
// incrementally (the mods API can't read files over 4 MiB).
async function refreshToday($: EngineInterface) {
  const r = await $.process.run(['node', `${$.plugin.root}/statusline.js`, '--today'], { timeoutMs: 10_000 })
  if (r.exitCode !== 0) return
  const today = JSON.parse(r.stdout) as { tokens: number; cost: number }
  await update($, usage, prev => ({ ...prev, today }))
}

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    await measure($)
    refreshToday($).catch(() => {})
    $.clock.every(TODAY_REFRESH_MS, () => refreshToday($).catch(() => {}))
    return next(e)
  })

  // /clear, /resume and /branch reset $.state without firing session.start again.
  on('classic.SessionStart', { source: ['clear', 'resume', 'fork'] }, async ($, e, next) => {
    await measure($)
    refreshToday($).catch(() => {})
    return next(e)
  })

  on('session.measure', async ($, e, next) => {
    await measure($)
    return next(e)
  })

  on('turn.complete', async ($, e, next) => {
    refreshToday($).catch(() => {})
    return next(e)
  })

  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    if (e.props.hasSurvey) return next(e)
    const u = await read($, usage)
    const now = await $.clock.now()
    const { Box, Text } = $.ui.resolve(e)
    const below = await next(e)

    const today = u.today ? `today ${formatTokens(u.today.tokens)} $${u.today.cost.toFixed(2)}` : 'today —'
    const reset5h = resetIn(u.fiveHour?.resetsAt, now)
    const reset7d = resetIn(u.sevenDay?.resetsAt, now)

    // Hovering 5h / 7d reveals its reset time on a row above. The reveal rows sit
    // above the gauges so showing them doesn't move what the pointer rests on.
    return (
      <Box flexDirection="column">
        {below}
        {reset5h && (
          <Box display="none" hover={{ scope: 'usageboard-5h', display: 'flex' }}>
            <Text dimColor>5h limit resets in {reset5h}</Text>
          </Box>
        )}
        {reset7d && (
          <Box display="none" hover={{ scope: 'usageboard-7d', display: 'flex' }}>
            <Text dimColor>7d limit resets in {reset7d}</Text>
          </Box>
        )}
        <Box flexDirection="row">
          <Text>
            {u.model ? u.model + SEP : ''}
            {gauge('ctx', u.context)}
            {SEP}
          </Text>
          <Box hover={{ scope: 'usageboard-5h' }}>
            <Text>{gauge('5h', u.fiveHour?.percent)}</Text>
          </Box>
          <Text>{SEP}</Text>
          <Box hover={{ scope: 'usageboard-7d' }}>
            <Text>{gauge('7d', u.sevenDay?.percent)}</Text>
          </Box>
          <Text>
            {SEP}
            {today}
          </Text>
        </Box>
      </Box>
    )
  })
}
