# claude-usage-statusline

[English](README.md)

零依賴的 [Claude Code](https://code.claude.com) 狀態列，一眼看出方案用量和今天在本機用了多少 token。

```
Opus 5.5 │ ctx ██░░░ 42% ☀️ │ 5h █░░░░ 23% ☀️ │ 7d ███░░ 61% ☁️ │ today 1.2M $3.45
```

| 欄位 | 意義 | 來源 |
|---|---|---|
| `Opus 5.5` | 目前使用的模型 | statusline stdin |
| `ctx` | Context window 使用比例 | statusline stdin |
| `5h` / `7d` | 方案的 5 小時／每週用量上限已用比例 | statusline stdin（`rate_limits`） |
| `today` | 從本機時間午夜起，所有 session 合計的 tokens 與估算金額 | `~/.claude/projects/**/*.jsonl` |

天氣 emoji 代表各項用量的吃緊程度：

| 使用率 | Emoji |
|---|---|
| 0–49% | ☀️ |
| 50–74% | ☁️ |
| 75–89% | 🌧️ |
| 90–100% | ⛈️ |

## 需求

- 支援狀態列的 Claude Code
- Node.js 18 以上
- `5h`／`7d` 只有 Claude.ai Pro／Max 訂閱帳號才有，而且要等 session 收到第一個回應後才會出現，否則會顯示 `—`。

## 安裝

```sh
git clone https://github.com/<you>/claude-usage-statusline.git ~/.claude/claude-usage-statusline
```

在 `~/.claude/settings.json` 加入：

```json
{
  "statusLine": {
    "type": "command",
    "command": "node ~/.claude/claude-usage-statusline/statusline.js"
  }
}
```

不開 Claude Code 也可以直接測試：

```sh
echo '{"model":{"display_name":"Opus 5.5"},"context_window":{"used_percentage":42}}' | node ~/.claude/claude-usage-statusline/statusline.js
```

## 「today」的計算方式

- 掃描 `~/.claude/projects` 和 `~/.config/claude/projects`（若有設定 `CLAUDE_CONFIG_DIR`，則改掃其中每個路徑，以逗號分隔）底下，今天午夜後有修改過的對話紀錄檔。
- 以 `message.id` + `requestId` 去除重複，做法和 [ccusage](https://github.com/ryoppippi/ccusage) 相同，因此數字應該會和 `npx ccusage daily` 一致。
- Tokens = input + output + cache 寫入 + cache 讀取。
- 金額依 `pricing.json`（Anthropic API 牌價）計算。如果你用的是訂閱方案，這是換算成 API 的等值金額，不是實際被收取的費用。
- 每次更新只讀取檔案新增的部分，進度快取在系統暫存目錄，每天自動重設。

## 自訂

- 門檻、emoji、進度條寬度和分隔符號：修改 `statusline.js` 開頭的常數。
- 價格：修改 `pricing.json`。模型 ID 以最長前綴比對，找不到價格的模型仍會計入 tokens，但金額算 $0。

## 隱私

全部在本機執行，不會發出任何網路請求，也不會讀取任何憑證。

## 授權

[MIT](LICENSE)
