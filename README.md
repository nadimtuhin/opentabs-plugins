# opentabs-plugins

Collection of browser automation plugins for [OpenTabs](https://github.com/opentabs-dev/opentabs).

Each plugin runs inside your authenticated Chrome or Chromium browser tab via the OpenTabs extension. All actions execute directly in your active session without external API keys or OAuth setups.

## Plugins

| Plugin | Domain | Description | Tools |
|---|---|---|---|
| [`fb-friends-manager`](./plugins/fb-friends-manager) | `*.facebook.com` | Facebook friend requests triage (accept, delete, mutual friends analysis) | 6 |
| [`greenhouse`](./plugins/greenhouse) | `*.greenhouse.io` | Reads and fills job application forms. Never submits | 3 |
| [`toptal`](./plugins/toptal) | `talent.toptal.com` | Fill talent application cover letters and edit profile sections | 7 |
| [`upwork`](./plugins/upwork) | `*.upwork.com` | Edit freelancer profiles (bio, skills chips, work categories) | 4 |

## Quick Start

### 1. Prerequisites
- Node.js >= 20
- OpenTabs CLI (`npm install -g @opentabs-dev/cli`)
- OpenTabs Chrome Extension installed and connected

### 2. Install Dependencies & Build
```bash
git clone https://github.com/nadimtuhin/opentabs-plugins.git
cd opentabs-plugins
npm install
npm run build
```

### 3. Register Plugins in OpenTabs
Add the built plugins to your `~/.opentabs/config.json`:

```json
{
  "localPlugins": [
    "/path/to/opentabs-plugins/plugins/fb-friends-manager",
    "/path/to/opentabs-plugins/plugins/greenhouse",
    "/path/to/opentabs-plugins/plugins/toptal",
    "/path/to/opentabs-plugins/plugins/upwork"
  ]
}
```

Restart or reload your OpenTabs server:
```bash
opentabs restart
```

## Safety Guardrails
- **No Automatic Submissions:** Form plugins (Greenhouse, Toptal) fill fields but never click Submit. You review the page and submit manually.
- **Trusted Types Compliant:** All plugins run in `jitless` mode to prevent CSP `require-trusted-types-for 'script'` failures on high-security web apps.
- **Session-Scoped:** No cookies or credentials leave your local browser runtime.

## License

MIT
