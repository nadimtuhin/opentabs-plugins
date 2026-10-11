# Upwork Profile Manager (OpenTabs Plugin)

Read and edit Upwork freelancer profiles directly through an authenticated browser tab. Drives the live DOM without direct network calls or private API bypasses.

## Tools (4)

| Tool | Description | Type |
|---|---|---|
| `get_profile` | Read current profile state: title, overview bio, active skills chips, and selected category tags | Read |
| `set_profile_text` | Update profile title and overview text with validation checks | Write |
| `set_skills` | Add and remove freelancer skill chips using Upwork's token picker | Write |
| `set_categories` | Update primary and secondary freelancer work categories | Write |

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
```

## License

MIT
