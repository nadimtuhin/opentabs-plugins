# Toptal Apply & Profile Manager (OpenTabs Plugin)

Fill Toptal Talent Portal job applications (cover letter, terms) and edit profile sections through an active browser session. Never submits job applications automatically.

## Tools (9)

| Tool | Parameters | Description | Type |
|---|---|---|---|
| `get_apply_state` | none | Read the open `/apply` page: job title, wizard step (`rate`, `cover_letter`, `other`), rate, cover letter length and terms checkbox | Read |
| `fill_cover_letter` | `text` (380-2000 chars) | Type the cover letter and tick the "I understand" box. Never clicks Submit Application | Write |
| `get_profile_form` | none | Read the text fields on the open `/settings/profile/<section>` page: key, type, value, invalid flag, helper hints, and the Save button label | Read |
| `fill_profile_fields` | `fields`: `{ "<key>": string or boolean }` | Set text fields and checkboxes by key (from `get_profile_form`). Does not save | Write |
| `save_profile` | none | Click Save on the profile section. Refuses if any field is invalid; returns the new URL and any validation errors | Write |
| `pick_option` | `field`: `industryIds` or `skills`, `label` | Select one option in a type-ahead picker by exact label. Call once per option | Write |
| `set_year` | `field`: `startDate` or `endDate`, `year` (1970-2100) | Set a year on the work-experience form | Write |
| `add_skill` | `name`, `proficiency`: `COMPETENT`, `STRONG` or `EXPERT`, `years` (1-20) | Add one skill on the Skills page, then click Done to save | Write |
| `remove_skill` | `name` | Remove one skill by exact name on the Skills page, then click Done to save | Write |

## Examples

```sh
# Cover letter step of /apply (380-2000 characters)
opentabs tool call toptal__fill_cover_letter '{"text":"I have built and shipped TypeScript browser extensions for six years, most recently a Chrome MV3 automation layer used by AI agents. On my last project I owned the plugin SDK, the build pipeline, and the test harness, and cut flaky end-to-end runs from twenty percent to under two. Your brief asks for someone who can work inside strict CSP pages and keep React forms in a valid state; that is exactly the work I do every week."}'

# Profile section: real keys come from get_profile_form; these are illustrative
opentabs tool call toptal__fill_profile_fields '{"fields":{"title":"Senior Software Engineer","current":true}}'
opentabs tool call toptal__pick_option '{"field":"industryIds","label":"Fintech"}'
opentabs tool call toptal__set_year '{"field":"startDate","year":2021}'

# Skills page (/talent/<id>/settings/profile/skills), one skill per call
opentabs tool call toptal__add_skill '{"name":"TypeScript","proficiency":"EXPERT","years":8}'
opentabs tool call toptal__remove_skill '{"name":"jQuery"}'
```

## Usage Notes

- `add_skill` and `remove_skill` handle one skill per call. Reload the Skills page between calls; after one add the picker shows no options until the page reloads.
- Skill and picker labels must exactly match Toptal's fixed list (e.g. `"Jira REST API"`). On a miss the tool returns `picked`/`added: false` with the options it saw.
- `fill_profile_fields` keys are the field `name` (or `id`) reported by `get_profile_form`. Unknown keys fail before anything is changed.

## Safety Guardrails

- Never clicks "Submit Application". Application submission is strictly reserved for user manual review.
- Sensitive consent checkboxes (SMS notifications, publication permit) are left untouched unless explicitly requested.

## Develop

```bash
npm install
npm run build
npm run type-check && npm run lint
npm test
```

## License

MIT
