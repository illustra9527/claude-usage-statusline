// Same thresholds and look as statusline.js.
export const BAR_WIDTH = 5
const WEATHER: [number, string][] = [
  [50, '☀️'], // sunny
  [75, '☁️'], // cloudy
  [90, '🌧️'], // rain
  [Infinity, '⛈️'], // storm
]
export const SEP = ' │ '

export function weather(pct: number): string {
  return WEATHER.find(([max]) => pct < max)![1]
}

export function bar(pct: number): string {
  const filled = Math.max(0, Math.min(BAR_WIDTH, Math.round((pct / 100) * BAR_WIDTH)))
  return '█'.repeat(filled) + '░'.repeat(BAR_WIDTH - filled)
}

export function gauge(label: string, pct: number | undefined): string {
  if (typeof pct !== 'number') return `${label} —`
  return `${label} ${bar(pct)} ${Math.round(pct)}% ${weather(pct)}`
}

/** "claude-opus-5-5" → "Opus 5.5"; anything else is returned as is. */
export function modelName(id: string): string {
  const m = id.match(/^claude-([a-z]+)-(\d+(?:-\d)?)\b/)
  if (!m) return id
  const family = m[1]!
  return `${family[0]!.toUpperCase()}${family.slice(1)} ${m[2]!.replace('-', '.')}`
}

export function formatTokens(n: number): string {
  if (n >= 1e9) return `${(n / 1e9).toFixed(1)}B`
  if (n >= 1e6) return `${(n / 1e6).toFixed(1)}M`
  if (n >= 1e3) return `${(n / 1e3).toFixed(1)}K`
  return String(n)
}

/** "2h 10m" until `resetsAt`, or undefined when unknown or past. */
export function resetIn(resetsAt: string | undefined, now: number): string | undefined {
  if (!resetsAt) return undefined
  const mins = Math.ceil((Date.parse(resetsAt) - now) / 60000)
  if (!(mins > 0)) return undefined
  const d = Math.floor(mins / 1440)
  const h = Math.floor((mins % 1440) / 60)
  const m = mins % 60
  if (d > 0) return `${d}d ${h}h`
  if (h > 0) return `${h}h ${m}m`
  return `${m}m`
}
