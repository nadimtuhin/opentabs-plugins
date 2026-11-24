// Selectors and labels mirror muse-auto-approve's content.js.
const CARD_SELECTOR =
  '[data-testid="hatch-inline-approval-card"]:not([data-hatch-background-approval-surface="true"])';
const BUTTON_SELECTOR = 'button, [role="button"]';
const PRIMARY_SELECTOR = '[data-hatch-approval-primary-action="true"]';
const ALWAYS_RE =
  /^(一律允許|永久允許|總是允許|始終允許|永遠允許|一律允许|永久允许|总是允许|始终允许|always allow|allow always)/i;
const ONCE_RE = /^(允許|允许|allow)( ?(一次|本次|此次|once|this time))?$/i;
const DENY_RE = /^(拒絕|拒绝|不允許|不允许|不要|不发|封鎖|阻擋|deny|reject|block|decline|don['’]t |do not )/i;

export type Decision = 'allow' | 'always' | 'deny';

const clean = (s: string | null | undefined) => (s ?? '').replace(/\s+/g, ' ').trim();
export const labelOf = (el: Element) => clean(el.getAttribute('aria-label') || (el as HTMLElement).innerText);
const visible = (el: Element) => (el as HTMLElement).offsetParent !== null && !(el as HTMLButtonElement).disabled;

export function cards(): HTMLElement[] {
  return [...document.querySelectorAll<HTMLElement>(CARD_SELECTOR)].filter(visible);
}

function buttonsOf(card: Element): HTMLElement[] {
  return [...card.querySelectorAll<HTMLElement>(BUTTON_SELECTOR)].filter(visible);
}

export function describeCard(card: HTMLElement, index: number) {
  return {
    index,
    surface: card.getAttribute('data-hatch-approval-surface') || '',
    text: clean(card.innerText).slice(0, 500),
    buttons: buttonsOf(card).map(labelOf).filter(Boolean),
  };
}

// "always" falls back to allow once when the card has no Always option.
export function findButton(card: HTMLElement, decision: Decision): HTMLElement | undefined {
  const buttons = buttonsOf(card);
  const byLabel = (re: RegExp) => buttons.find(b => re.test(labelOf(b)));
  if (decision === 'deny') return byLabel(DENY_RE);
  const primary = card.querySelector<HTMLElement>(PRIMARY_SELECTOR) ?? undefined;
  if (decision === 'always') return byLabel(ALWAYS_RE) ?? byLabel(ONCE_RE) ?? primary;
  return byLabel(ONCE_RE) ?? primary;
}
