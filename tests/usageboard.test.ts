import { expect, mock, test } from 'claude-code/testing'

import { bar, formatTokens, gauge, modelName, resetIn, weather } from '../hooks/format'

test('weather follows the 50 / 75 / 90 thresholds', () => {
  expect([0, 49, 50, 74, 75, 89, 90, 100].map(weather)).toEqual(['☀️', '☀️', '☁️', '☁️', '🌧️', '🌧️', '⛈️', '⛈️'])
})

test('gauge draws a 5-cell bar, or a dash when unknown', () => {
  expect(bar(42)).toBe('██░░░')
  expect(gauge('5h', 23.5)).toBe('5h █░░░░ 24% ☀️')
  expect(gauge('7d', undefined)).toBe('7d —')
})

test('model ids become display names', () => {
  expect(modelName('claude-opus-5-5')).toBe('Opus 5.5')
  expect(modelName('claude-haiku-4-5-20251001')).toBe('Haiku 4.5')
  expect(modelName('claude-opus-5[1m]')).toBe('Opus 5')
  expect(modelName('Opus 5.5')).toBe('Opus 5.5')
})

test('tokens are abbreviated', () => {
  expect(formatTokens(999)).toBe('999')
  expect(formatTokens(1234)).toBe('1.2K')
  expect(formatTokens(1_234_567)).toBe('1.2M')
})

test('reset countdown', () => {
  const now = Date.parse('2026-10-07T10:00:00Z')
  expect(resetIn('2026-10-07T12:10:00Z', now)).toBe('2h 10m')
  expect(resetIn('2026-10-07T10:05:00Z', now)).toBe('5m')
  expect(resetIn('2026-10-09T13:00:00Z', now)).toBe('2d 3h')
  expect(resetIn('2026-10-07T09:00:00Z', now)).toBeUndefined()
  expect(resetIn(undefined, now)).toBeUndefined()
})

const BAND = {
  plugin: 'usageboard',
  component: 'AbovePrompt',
  requestId: 'above-prompt',
  viewport: { columns: 160, rows: 40 },
  props: { hasSurvey: false, isWorking: false, maxRows: 20, bodyColumns: 160, scroll: { offset: 0, bodyRows: 20 }, view: {} },
} as const

for (const surface of ['terminal', 'desktop'] as const) {
  test(`the band shows model, context, limits and today on ${surface}`, async ($, on) => {
    const clock = mock.clock(on)
    const resetsAt = new Date(clock.now() + 2 * 3600_000).toISOString()
    on('session.start', () => ({ cwd: '/work' }))
    on('session.usage', () => ({
      value: {
        startedAt: 0,
        context: { window: 1_000_000, tokens: 420_000, percent: 42 },
        rateLimits: [
          { kind: 'five_hour', percentUsed: 82, resetsAt },
          { kind: 'seven_day', percentUsed: 61 },
        ],
      },
    }))
    on('session.model', () => ({ value: 'claude-opus-5-5' }))
    on('process.run', () => ({
      value: { exitCode: 0, stdout: '{"tokens":1234567,"cost":3.456}', stderr: '', isStdoutTruncated: false, isStderrTruncated: false },
    }))
    on('ui.render', () => ({ type: 'Text', props: {}, children: ['engine band'] }))

    await $.session.start({ surface, isInteractive: true, cwd: '/work' })
    await clock.advance(0)

    const ui = await $.ui.mount({ ...BAND, surface })
    expect(await ui.find({ text: /Opus 5\.5 │ ctx ██░░░ 42% ☀️/ })).toBeDefined()
    expect(await ui.find({ text: '5h ████░ 82% 🌧️' })).toBeDefined()
    expect(await ui.find({ text: '7d ███░░ 61% ☁️' })).toBeDefined()
    expect(await ui.find({ text: /today 1\.2M \$3\.46/ })).toBeDefined()
    // The reset row is drawn hidden, for hover to reveal; 7d has no reset time.
    expect(await ui.find({ text: '5h limit resets in 2h 0m' })).toBeDefined()
    expect(await ui.find({ text: /7d limit resets/ })).toBeUndefined()
    // Other mods' band content is kept.
    expect(await ui.find({ text: 'engine band' })).toBeDefined()
    await ui.unmount()
  })
}

test('limits show a dash off a subscription', async ($, on) => {
  mock.clock(on)
  on('session.start', () => ({ cwd: '/work' }))
  on('session.usage', () => ({ value: { startedAt: 0, context: { window: 200_000 }, rateLimits: [] } }))
  on('session.model', () => ({ value: 'Sonnet 5.5' }))
  on('process.run', () => ({ value: { exitCode: 1, stdout: '', stderr: 'no node', isStdoutTruncated: false, isStderrTruncated: false } }))
  on('ui.render', () => ({ type: 'Text', props: {}, children: [''] }))

  await $.session.start({ surface: 'terminal', isInteractive: true, cwd: '/work' })
  const ui = await $.ui.mount({ ...BAND, surface: 'terminal' })
  expect(await ui.find({ text: /ctx —/ })).toBeDefined()
  expect(await ui.find({ text: '5h —' })).toBeDefined()
  expect(await ui.find({ text: /today —/ })).toBeDefined()
  await ui.unmount()
})
