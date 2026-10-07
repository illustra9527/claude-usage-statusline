# claude-usage-statusline

[繁體中文](README.zh-TW.md)

See your [Claude Code](https://code.claude.com) plan usage and today's local token spend at a glance. Use it as a **mod** (drawn above the prompt) or as a classic **status line** script (drawn below it).

```
Opus 5.5 │ ctx ██░░░ 42% ☀️ │ 5h █░░░░ 23% ☀️ │ 7d ███░░ 61% ☁️ │ today 1.2M $3.45
```

| Segment | Meaning |
|---|---|
| `Opus 5.5` | Current model |
| `ctx` | Context window used |
| `5h` / `7d` | 5-hour / weekly plan rate limit used |
| `today` | Tokens and estimated cost since local midnight, across all sessions |

The weather emoji reflects how heavily each limit is used:

| Usage | Emoji |
|---|---|
| 0–49% | ☀️ |
| 50–74% | ☁️ |
| 75–89% | 🌧️ |
| 90–100% | ⛈️ |

## Mod or status line?

Both show the same line. Pick one, not both.

| | Mod | Status line |
|---|---|---|
| How it works | Code that runs inside Claude Code and reacts to its events | A script Claude Code runs on each update, printing one line of text |
| Where it shows | Above the prompt | Below the prompt |
| Reset countdown | Hover `5h` / `7d` to see when the limit resets | — |
| Install | `/plugin install` | Edit `settings.json` |
| Claude Code version | 2.1.287 or later | Any version with status line support |

## Requirements

- Node.js 18+ (both versions use `statusline.js` to read today's usage)
- `5h` / `7d` are only available to Claude.ai Pro / Max subscribers, and appear after the first response in a session. Otherwise they show `—`. `ctx` also shows `—` until the first response.

## Install as a mod

Inside Claude Code:

```
/plugin marketplace add illustra9527/claude-usage-statusline
/plugin install usageboard@claude-usage-statusline
/reload-plugins
```

Run `/plugin` to check that `usageboard` is listed as an active mod. To turn it off, disable it in `/plugin`.

## Install as a status line

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
- The mod runs `node statusline.js --today` after each turn and once a minute, since a mod can't read files over 4 MiB.

## Customize

- Thresholds, emoji, bar width and separator: constants at the top of `statusline.js` (status line) and `hooks/format.ts` (mod).
- Prices: edit `pricing.json`. Model IDs are matched by longest prefix; unknown models count tokens but cost $0.

## Development

```sh
claude --plugin-dir .        # load the mod for one session; edits reload on save
claude plugin validate .claude-plugin/plugin.json
claude plugin test .
```

## Privacy

Everything runs locally. Neither version makes network requests or reads credentials.

## License

[MIT](LICENSE)
