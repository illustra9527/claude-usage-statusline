# claude-usage-statusline

[English](README.md)

一眼看出 [Claude Code](https://code.claude.com) 的方案用量，以及今天在本機用了多少 token。可以裝成 **mod**（顯示在輸入框上方），也可以用傳統的 **statusline** 腳本（顯示在輸入框下方）。

```
Opus 5.5 │ ctx ██░░░ 42% ☀️ │ 5h █░░░░ 23% ☀️ │ 7d ███░░ 61% ☁️ │ today 1.2M $3.45
```

| 欄位 | 意義 |
|---|---|
| `Opus 5.5` | 目前使用的模型 |
| `ctx` | Context window 使用比例 |
| `5h` / `7d` | 方案的 5 小時／每週用量上限已用比例 |
| `today` | 從本機時間午夜起，所有 session 合計的 tokens 與估算金額 |

天氣 emoji 代表各項用量的吃緊程度：

| 使用率 | Emoji |
|---|---|
| 0–49% | ☀️ |
| 50–74% | ☁️ |
| 75–89% | 🌧️ |
| 90–100% | ⛈️ |

## 要用 mod 還是 statusline？

兩者顯示的內容相同，擇一使用即可，不要兩個同時開。

| | Mod | Statusline |
|---|---|---|
| 運作方式 | 在 Claude Code 內部執行的程式，會對 Claude Code 的事件做出反應 | Claude Code 每次更新時執行的腳本，印出一行文字 |
| 顯示位置 | 輸入框上方 | 輸入框下方 |
| 重置倒數 | 滑鼠移到 `5h`／`7d` 上，會顯示多久後重置 | — |
| 安裝方式 | `/plugin install` | 修改 `settings.json` |
| Claude Code 版本 | 2.1.287 以上 | 支援 statusline 的版本皆可 |

## 需求

- Node.js 18 以上（兩個版本都用 `statusline.js` 讀取今日用量）
- `5h`／`7d` 只有 Claude.ai Pro／Max 訂閱帳號才有，而且要等 session 收到第一個回應後才會出現，否則會顯示 `—`。`ctx` 在收到第一個回應前也會顯示 `—`。

## 安裝成 mod

在 Claude Code 裡執行：

```
/plugin marketplace add illustra9527/claude-usage-statusline
/plugin install usageboard@claude-usage-statusline
/reload-plugins
```

執行 `/plugin` 可以確認 `usageboard` 是否已啟用。要關閉的話，在 `/plugin` 裡停用即可。

## 安裝成 statusline

```sh
git clone https://github.com/illustra9527/claude-usage-statusline.git ~/.claude/claude-usage-statusline
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
- mod 版會在每一輪對話結束後，以及每分鐘執行一次 `node statusline.js --today`，因為 mod 無法讀取超過 4 MiB 的檔案。

## 自訂

- 門檻、emoji、進度條寬度和分隔符號：statusline 版改 `statusline.js` 開頭的常數，mod 版改 `hooks/format.ts`。
- 價格：修改 `pricing.json`。模型 ID 以最長前綴比對，找不到價格的模型仍會計入 tokens，但金額算 $0。

## 開發

```sh
claude --plugin-dir .        # 只在這次啟動載入 mod，存檔後會自動重新載入
claude plugin validate .claude-plugin/plugin.json
claude plugin test .
```

## 隱私

全部在本機執行，兩個版本都不會發出任何網路請求，也不會讀取任何憑證。

## 授權

[MIT](LICENSE)
