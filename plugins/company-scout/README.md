# Company Scout (OpenTabs plugin)

Extracts company profiles, tech stack signals, and leadership info from startup directories (Y Combinator) and platform marketplaces (Square App Marketplace) in your own Chrome tab.

## Tools (1)

| Tool | What it does | Type |
|---|---|---|
| `extract_company_dossier` | Extract company name, tagline, description, detected platform integrations, tech stack keywords, and team members from the active tab | Read |

## Limits

- Works on active tabs matching `ycombinator.com/companies/*` or `squareup.com/*app-marketplace*`.
- Extracts read-only signals from rendered DOM without making background API calls.

## Example

```sh
opentabs tool call company-scout__extract_company_dossier '{}'
```

## Develop

```sh
npm install
npm run build        # registers in ~/.opentabs/config.json
npm run type-check && npm run lint
```

## License

MIT
