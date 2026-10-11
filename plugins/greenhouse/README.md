# Greenhouse Apply (OpenTabs plugin)

Reads and fills Greenhouse job application forms (job-boards.greenhouse.io) in your own Chrome tab. It never clicks Submit: you review the form and submit yourself. Public job pages need no login.

## Tools

| Tool | What it does | Type |
|---|---|---|
| `get_application_form` | Every field with id, label, type, required flag, current value and dropdown options, plus required fields still empty | Read |
| `fill_application` | `{"answers": {"<id or words from the label>": "value" or ["a","b"]}}`. Dropdowns and checkboxes match an option exactly, then by prefix, then by substring. Returns filled values read back from the page, failures with reasons, and required fields still empty | Write |
| `attach_file` | `{"field": "resume" or "cover_letter", "filename": "x.pdf", "content_base64": "..."}` | Write |

## How dropdowns are filled

Greenhouse uses react-select, whose menu only opens on real mouse events. The plugin finds the component on the React fiber and calls its `selectOption()`. This is the part most likely to break if Greenhouse changes its front end.

## Limits

- Location (City) loads options from a search as you type, so fill it by hand.
- Phone needs the country code dropdown (`country`) and the number (`phone`).
- Only the hosted board (job-boards.greenhouse.io) is tested. Forms embedded on company sites in an iframe are not covered.

## Example

```sh
opentabs tool call greenhouse__fill_application '{"answers":{"first_name":"Jane","How did you hear":"Job board","sponsorship":"Not applicable"}}'
```

## Develop

```sh
npm install
npm run build        # registers in ~/.opentabs/config.json
npm run type-check && npm run lint
```

## License

MIT
