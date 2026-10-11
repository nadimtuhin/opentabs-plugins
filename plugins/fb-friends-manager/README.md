# Facebook Friends Manager (OpenTabs Plugin)

Facebook friend requests and friends management with intelligent triage suggestions (accept vs delete) — gives AI agents access to Facebook Friends Manager through your authenticated browser session.

## Tools (6)

| Tool | Description | Type |
|---|---|---|
| `list_friend_requests` | List pending incoming Facebook friend requests with requester details, mutual friend counts, and timestamps | Read |
| `suggest_triage` | Analyzes pending friend requests and recommends ACCEPT, DELETE, or REVIEW based on configurable mutual thresholds and age | Read |
| `confirm_friend_request` | Accept an incoming friend request by user ID or vanity username | Write |
| `delete_friend_request` | Decline or delete an incoming friend request by user ID or vanity username | Write |
| `batch_triage_requests` | Batch-process accept and delete actions with safety delays to respect Facebook rate limits | Write |
| `get_friends_overview` | Return statistical overview and health metrics: mutual count tiers and request age distribution | Read |

## How It Works

This plugin runs inside your Facebook tab (`*://*.facebook.com/*`) through the [OpenTabs](https://opentabs.dev) Chrome extension. It uses your existing authenticated browser session — no API tokens or OAuth apps required. All operations run directly in your browser with your active permissions.

## Develop

```bash
npm install
npm run build
npm run type-check && npm run lint
```

## License

MIT
