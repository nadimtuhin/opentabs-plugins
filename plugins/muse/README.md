# Muse Approvals (OpenTabs plugin)

Lists and answers the approval cards the muse.ai assistant shows when it wants to open a site or run an action. Selectors come from the Auto Approve for Muse extension.

## Tools (2)

- `list_approvals`: visible approval cards in the open chat or Approvals panel, with text, surface and button labels.
- `respond_approval`: takes `index`, `decision` (`allow`, `always`, `deny`) and `expect_text`. Clicks one button only if the card text still contains `expect_text`. `always` falls back to allow once when the card has no Always option.

## Use

1. Open the muse.ai chat that is waiting.
2. `muse__list_approvals`
3. Answer one card:

```bash
opentabs tool call muse__respond_approval '{"index":0,"decision":"always","expect_text":"github.com"}'
```
