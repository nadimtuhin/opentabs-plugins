# Toptal Apply & Profile Manager (OpenTabs Plugin)

Fill Toptal Talent Portal job applications (cover letter, terms) and edit profile sections through an active browser session. Never submits job applications automatically.

## Tools (7)

| Tool | Description | Type |
|---|---|---|
| `get_apply_state` | Read active job application modal state: title, rate limits, cover letter input status | Read |
| `fill_cover_letter` | Fill cover letter text area in the active job application modal. Never submits | Write |
| `get_profile_form` | Read editable fields on the open profile section (`/settings/profile/<section>`): keys, values, and validation rules | Read |
| `fill_profile_fields` | Fill text inputs and checkbox fields on the profile edit form | Write |
| `save_profile` | Click the Save button on the profile form and verify changes | Write |
| `pick_option` | Select custom dropdown and radio option components | Write |
| `set_year` | Set year picker and timeline date dropdowns | Write |

## Safety Guardrails

- Never clicks "Submit Application" — application submission is strictly reserved for user manual review.
- Sensitive consent checkboxes (SMS notifications, public directory indexing) are left untouched unless explicitly requested.

## Develop

```bash
npm install
npm run build
npm run type-check && npm run lint
```

## License

MIT
