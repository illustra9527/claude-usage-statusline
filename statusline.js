#!/usr/bin/env node
// Claude Code statusline: model, context %, 5h/7d rate limits, today's local token usage & cost.
// Zero dependencies. Reads the statusline JSON from stdin.
'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');

// ---- Customize here -------------------------------------------------------
const BAR_WIDTH = 5;
const WEATHER = [
  // [upper bound (exclusive), emoji]
  [50, '☀️'],  // sunny
  [75, '☁️'],  // cloudy
  [90, '🌧️'],  // rain
  [Infinity, '⛈️'], // storm
];
const SEP = ' │ ';
// ---------------------------------------------------------------------------

const CACHE_VERSION = 1;
const CACHE_FILE = path.join(os.tmpdir(), `claude-usage-statusline-${os.userInfo().uid}.json`);
const PRICING = JSON.parse(fs.readFileSync(path.join(__dirname, 'pricing.json'), 'utf8')).models;
const PRICING_KEYS = Object.keys(PRICING).sort((a, b) => b.length - a.length);

function weather(pct) {
  return WEATHER.find(([max]) => pct < max)[1];
}

function bar(pct) {
  const filled = Math.max(0, Math.min(BAR_WIDTH, Math.round((pct / 100) * BAR_WIDTH)));
  return '█'.repeat(filled) + '░'.repeat(BAR_WIDTH - filled);
}

function gauge(label, pct) {
  if (typeof pct !== 'number') return `${label} —`;
  return `${label} ${bar(pct)} ${Math.round(pct)}% ${weather(pct)}`;
}

function formatTokens(n) {
  if (n >= 1e9) return `${(n / 1e9).toFixed(1)}B`;
  if (n >= 1e6) return `${(n / 1e6).toFixed(1)}M`;
  if (n >= 1e3) return `${(n / 1e3).toFixed(1)}K`;
  return String(n);
}

function priceFor(model) {
  const key = model && PRICING_KEYS.find((k) => model.startsWith(k));
  return key ? PRICING[key] : null;
}

function costOf(model, u) {
  const p = priceFor(model);
  if (!p) return 0;
  const write1h = u.cache_creation?.ephemeral_1h_input_tokens ?? 0;
  const write5m = (u.cache_creation_input_tokens ?? 0) - write1h;
  const usd =
    (u.input_tokens ?? 0) * p.input +
    (u.output_tokens ?? 0) * p.output +
    write5m * p.input * 1.25 +
    write1h * p.input * 2 +
    (u.cache_read_input_tokens ?? 0) * p.cacheRead;
  const fast = u.speed === 'fast' ? p.fast ?? 1 : 1;
  return (usd * fast) / 1e6;
}

function projectDirs() {
  const dirs = [];
  if (process.env.CLAUDE_CONFIG_DIR) {
    for (const d of process.env.CLAUDE_CONFIG_DIR.split(',')) dirs.push(path.join(d.trim(), 'projects'));
  } else {
    dirs.push(path.join(os.homedir(), '.claude', 'projects'));
    dirs.push(path.join(os.homedir(), '.config', 'claude', 'projects'));
  }
  return dirs.filter((d) => fs.existsSync(d));
}

// Recursively list .jsonl files modified since `since` (ms).
function recentJsonl(dir, since, out = []) {
  let entries;
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return out;
  }
  for (const e of entries) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) recentJsonl(p, since, out);
    else if (e.name.endsWith('.jsonl')) {
      try {
        const st = fs.statSync(p);
        if (st.mtimeMs >= since) out.push({ path: p, size: st.size });
      } catch {}
    }
  }
  return out;
}

function localDateKey(d = new Date()) {
  return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
}

function loadCache(today) {
  try {
    const c = JSON.parse(fs.readFileSync(CACHE_FILE, 'utf8'));
    if (c.version === CACHE_VERSION && c.date === today) {
      c.seen = new Set(c.seen);
      return c;
    }
  } catch {}
  return { version: CACHE_VERSION, date: today, offsets: {}, seen: new Set(), tokens: 0, cost: 0 };
}

function saveCache(c) {
  const tmp = `${CACHE_FILE}.${process.pid}`;
  try {
    fs.writeFileSync(tmp, JSON.stringify({ ...c, seen: [...c.seen] }));
    fs.renameSync(tmp, CACHE_FILE);
  } catch {}
}

// Read only the bytes appended since last run; process complete lines.
function readNew(file, offset) {
  const len = file.size - offset;
  if (len <= 0) return { lines: [], offset };
  const buf = Buffer.alloc(len);
  const fd = fs.openSync(file.path, 'r');
  try {
    fs.readSync(fd, buf, 0, len, offset);
  } finally {
    fs.closeSync(fd);
  }
  const lastNl = buf.lastIndexOf(0x0a);
  if (lastNl < 0) return { lines: [], offset };
  return { lines: buf.subarray(0, lastNl).toString('utf8').split('\n'), offset: offset + lastNl + 1 };
}

function todayUsage() {
  const midnight = new Date();
  midnight.setHours(0, 0, 0, 0);
  const cache = loadCache(localDateKey(midnight));

  for (const dir of projectDirs()) {
    for (const file of recentJsonl(dir, midnight.getTime())) {
      let offset = cache.offsets[file.path] ?? 0;
      if (file.size < offset) offset = 0; // file was rewritten
      const res = readNew(file, offset);
      cache.offsets[file.path] = res.offset;

      for (const line of res.lines) {
        if (!line.includes('"usage"')) continue;
        let e;
        try {
          e = JSON.parse(line);
        } catch {
          continue;
        }
        const u = e.message?.usage;
        if (!u || !e.timestamp || new Date(e.timestamp) < midnight) continue;
        if (e.message.id && e.requestId) {
          const key = `${e.message.id}:${e.requestId}`;
          if (cache.seen.has(key)) continue;
          cache.seen.add(key);
        }
        cache.tokens +=
          (u.input_tokens ?? 0) +
          (u.output_tokens ?? 0) +
          (u.cache_creation_input_tokens ?? 0) +
          (u.cache_read_input_tokens ?? 0);
        cache.cost += costOf(e.message.model, u);
      }
    }
  }

  saveCache(cache);
  return cache;
}

function render(input) {
  const parts = [];
  if (input.model?.display_name) parts.push(input.model.display_name);
  parts.push(gauge('ctx', input.context_window?.used_percentage));
  parts.push(gauge('5h', input.rate_limits?.five_hour?.used_percentage));
  parts.push(gauge('7d', input.rate_limits?.seven_day?.used_percentage));
  try {
    const t = todayUsage();
    parts.push(`today ${formatTokens(t.tokens)} $${t.cost.toFixed(2)}`);
  } catch {
    parts.push('today —');
  }
  return parts.join(SEP);
}

// `--today`: print today's totals as JSON (used by the mod version).
if (process.argv.includes('--today')) {
  const t = todayUsage();
  process.stdout.write(JSON.stringify({ tokens: t.tokens, cost: t.cost }));
  return;
}

let raw = '';
process.stdin.setEncoding('utf8');
process.stdin.on('data', (d) => (raw += d));
process.stdin.on('end', () => {
  let input = {};
  try {
    input = JSON.parse(raw);
  } catch {}
  process.stdout.write(render(input));
});
