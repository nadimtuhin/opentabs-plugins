# Upwork Profile Manager (OpenTabs Plugin)

Read and edit Upwork freelancer profiles directly through an authenticated browser tab. Drives the live DOM without direct network calls or private API bypasses.

## Tools (4)

| Tool | Parameters | Description | Type |
|---|---|---|---|
| `get_profile` | none | Read the open profile page (`/freelancers/~<id>`): title, hourly rate, overview, skills, and employment history lines | Read |
| `set_profile_text` | `section`: `title` or `overview`, `text` | Replace the title (max 70 chars) or overview (max 5000 chars, no links) and click Save | Write |
| `set_skills` | `skills`: 1-20 names | Make the profile skills exactly this list. Removes extras, adds exact-name matches, reports misses in `not_found`. Saves only if nothing was missing | Write |
| `set_categories` | `categories`: 1-10 sub-category names | On `/freelancers/settings/profile`, make the selected categories exactly this list and click Save | Write |

## Examples

```sh
# On https://www.upwork.com/freelancers/~<id>
opentabs tool call upwork__get_profile '{}'
opentabs tool call upwork__set_profile_text '{"section":"title","text":"Senior TypeScript Engineer | Browser Automation"}'
opentabs tool call upwork__set_skills '{"skills":["TypeScript","Node.js","React","Chrome Extension"]}'

# On https://www.upwork.com/freelancers/settings/profile
opentabs tool call upwork__set_categories '{"categories":["Web Development","AI Apps & Integration"]}'
```

## Non-Supported Actions (By Design)

The following financial, visibility, and contractual operations are intentionally out of scope:
- Hourly rates and billing preferences
- Profile visibility and "Open to work" status
- Connects purchasing and proposals submission
- Payment method and withdrawal configurations

## Production Pitfalls

- Skill chips expose text via `innerText` instead of standard `aria-label` selectors.
- Upwork typeahead inputs require explicit synthetic focus and input events to bind to Angular/React internal states.
- Mutations persist asynchronously on Upwork's backend (~20–25s); refresh the page to confirm changes.

## Develop

```bash
npm install
npm run build
npm run type-check && npm run lint
npm test
```

## License

MIT
