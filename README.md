# claude-usage-statusline

[繁體中文](README.zh-TW.md)

A zero-dependency [Claude Code](https://code.claude.com) status line that shows your plan usage and today's local token spend at a glance.

```
Opus 5.5 │ ctx ██░░░ 42% ☀️ │ 5h █░░░░ 23% ☀️ │ 7d ███░░ 61% ☁️ │ today 1.2M $3.45
```

| Segment | Meaning | Source |
|---|---|---|
| `Opus 5.5` | Current model | statusline stdin |
| `ctx` | Context window used | statusline stdin |
| `5h` / `7d` | 5-hour / weekly plan rate limit used | statusline stdin (`rate_limits`) |
| `today` | Tokens and estimated cost since local midnight, across all sessions | `~/.claude/projects/**/*.jsonl` |

The weather emoji reflects how heavily each limit is used:

| Usage | Emoji |
|---|---|
| 0–49% | ☀️ |
| 50–74% | ☁️ |
| 75–89% | 🌧️ |
| 90–100% | ⛈️ |

## Requirements

- Claude Code with status line support
- Node.js 18+
- `5h` / `7d` are only available to Claude.ai Pro / Max subscribers, and appear after the first response in a session. Otherwise they show `—`.

## Install

```sh
git clone https://github.com/illustra9527/claude-usage-statusline.git ~/.claude/claude-usage-statusline
```

Add to `~/.claude/settings.json`:

```json
{
  "statusLine": {
    "type": "command",
    "command": "node ~/.claude/claude-usage-statusline/statusline.js"
  }
}
```

Test it without Claude Code:

```sh
echo '{"model":{"display_name":"Opus 5.5"},"context_window":{"used_percentage":42}}' | node ~/.claude/claude-usage-statusline/statusline.js
```

## How "today" is calculated

- Scans transcript files modified since local midnight under `~/.claude/projects` and `~/.config/claude/projects` (or each path in `CLAUDE_CONFIG_DIR`, comma-separated).
- Deduplicates entries by `message.id` + `requestId`, same as [ccusage](https://github.com/ryoppippi/ccusage), so totals should match `npx ccusage daily`.
- Tokens = input + output + cache write + cache read.
- Cost uses `pricing.json` (Anthropic API list prices). On a subscription plan this is the API-equivalent value, not what you are billed.
- Only newly appended bytes are read on each refresh; progress is cached in your OS temp directory and resets daily.

## Customize

- Thresholds, emoji, bar width and separator: constants at the top of `statusline.js`.
- Prices: edit `pricing.json`. Model IDs are matched by longest prefix; unknown models count tokens but cost $0.

## Privacy

Everything runs locally. The script makes no network requests and does not read credentials.

## License

[MIT](LICENSE)
