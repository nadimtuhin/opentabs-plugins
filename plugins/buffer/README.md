# Buffer Scheduler (OpenTabs plugin)

Schedules Buffer drafts that already have a date and time. Creating and editing posts is left to the Buffer MCP/API; this covers the one step the API left as drafts.

Never presses "Publish now", "Share next" or "Add to Queue".

## Tools (2)

- `list_drafts`: drafts on the Drafts tab with preview text, channel, and whether each one already has a time.
- `schedule_drafts`: takes `match` (1 to 10 preview prefixes). For each: clicks "Schedule Post", reads the date Buffer shows, confirms, and checks that the Queue count went up. Stops at the first failure.

## Use

1. Open `https://publish.buffer.com` and click the Drafts tab with a trusted click (`browser_click_element` on `#drafts-tab`). A plain JS click does nothing there.
2. `buffer__list_drafts`
3. Schedule by preview text:

```bash
opentabs tool call buffer__schedule_drafts '{"match":["I had an AI agent","Agent said it ticked"]}'
```
