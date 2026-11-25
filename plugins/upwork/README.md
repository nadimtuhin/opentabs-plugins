# Upwork Profile Manager (OpenTabs Plugin)

Read and edit Upwork freelancer profiles directly through an authenticated browser tab. Drives the live DOM without direct network calls or private API bypasses.

## Tools (4)

| Tool | Parameters | Description | Type |
|---|---|---|---|
| `get_profile` | none | Read the open profile page (`/freelancers/~<id>`): title, hourly rate, overview, skills, and employment history lines | Read |
| `set_profile_text` | `section`: `title` or `overview`, `text` | Replace the title (max 70 chars) or overview (max 5000 chars; `http://`, `https://`, and `www.` links are rejected) and click Save | Write |
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

## Reading the profile

`get_profile` takes the title from the nearest non-empty line above the `$80.00/hr` rate, so a blank line between them does not erase the title. The overview runs until a line that is exactly `more` or the next section heading (`Skills`, `Employment history`, and the other profile headings). A short profile with no `more` link still returns its overview. A line that merely mentions "Skills" does not end it.

`set_profile_text` checks the title length, the overview length, and overview links before it opens the editor.

## Production Pitfalls

- Skill chips expose text via `innerText` instead of standard `aria-label` selectors. A trailing `selected` on a menu row is ignored in either case.
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
