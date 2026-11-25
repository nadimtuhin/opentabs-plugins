# Buffer Scheduler (OpenTabs plugin)

Schedules Buffer drafts that already have a date and time. Creating and editing posts is left to the Buffer MCP/API; this covers the one step the API left as drafts.

Never presses "Publish now", "Share next", or "Add to Queue".

## Tools (2)

| Tool | Parameters | What it does | Type |
| --- | --- | --- | --- |
| `list_drafts` | none | Drafts on the Drafts tab: preview text, channel, and whether each one already has a time | Read |
| `schedule_drafts` | `match`: 1 to 10 strings, each at least 3 characters | Schedules timed drafts whose preview starts with the string. Stops at the first failure | Write |

## Matching

`list_drafts` reads each card's `Edit draft "<preview>" for <channel>` label. The preview is the text inside the quotes, so a post that itself contains ` for ` stays one draft. A trailing `…` means Buffer truncated the preview, and that ellipsis is not part of the text `list_drafts` returns.

`schedule_drafts` keeps a draft when the preview starts with the match string. A match longer than the preview counts only when that preview was truncated and is at least 12 characters, so a short card does not swallow a longer post. Zero matches or more than one match stops the call. A draft whose button is "Add to Queue" stops the call too, because it has no time set.

## Use

1. Open `https://publish.buffer.com` and click the Drafts tab with a trusted click (`browser_click_element` on `#drafts-tab`). A plain JS click does nothing there.
2. `buffer__list_drafts`
3. Schedule by preview text:

```bash
opentabs tool call buffer__schedule_drafts '{"match":["I had an AI agent","Agent said it ticked"]}'
```

## Develop

```bash
npm install
npm run build
npm run type-check && npm run lint
npm test
```

## License

MIT
