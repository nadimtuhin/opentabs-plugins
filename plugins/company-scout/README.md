# Company Scout (OpenTabs plugin)

Extracts company profiles, tech stack signals, and leadership info from startup directories (Y Combinator) and platform marketplaces (Square App Marketplace) in your own Chrome tab.

## Tools (1)

| Tool | What it does | Type |
| --- | --- | --- |
| `extract_company_dossier` | Company name, tagline, description, detected platform integrations, tech stack keywords, and founder names from the active tab | Read |

## What it reads

- **Name.** The `h1`. When the page has no heading, the document title up to a spaced separator (`|`, `-`, `–`, `—`). A hyphen inside the name, as in `Well-Known Labs | Y Combinator`, stays in the name.
- **Tagline.** The subtitle under the heading (`h1 + p`, `h1 + h2`, a tagline test id, or `.tagline`). When that is missing or is just the company name, the first sentence of the meta description. The tagline is not a copy of the name.
- **Description.** The meta description, capped at 500 characters. When the page has no meta description, the first body line of at least 40 characters that is not the name or the tagline.
- **Keywords.** Platform and stack words matched on the visible text and the meta description. `Go`, `Square`, `Toast`, `Clover`, `Epic`, and `AWS` match only with that capitalization, so "go to", "toast", and `aws.amazon.com` do not count. `Node.js` matches the dotted name and does not match `NodeXjs`. A hyphen is part of the word, so `Go-to-market` is not `Go`.
- **Founders.** The first line of each founder or team element, when it looks like a person's name. A trailing role such as `CEO` is removed. Role-only labels and duplicates are skipped. At most five names.

Marketplace chrome can add a keyword. A Square listing that says `Square` in the header reports `Square`.

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
npm test
```

## License

MIT
