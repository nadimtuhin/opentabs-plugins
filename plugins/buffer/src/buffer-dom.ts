// DOM helpers for publish.buffer.com Drafts. Learned live:
// - The Drafts tab only reacts to a trusted click (use browser_click_element on #drafts-tab).
// - Card buttons and the confirm dialog accept el.click() once scrolled into view.
// - Each card has an action button ("Schedule Post" when the draft already has a time,
//   "Add to Queue" when not) followed by an `Edit draft "<preview>" for <channel>` button.

export const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

export const counts = () => {
  const n = (prefix: string) => {
    const t = [...document.querySelectorAll<HTMLElement>('[role=tab]')].find(t =>
      t.innerText.trim().startsWith(prefix),
    );
    return Number(t?.innerText.match(/\d+/)?.[0] ?? -1);
  };
  return { queue: n('Queue'), drafts: n('Drafts') };
};

export const onDraftsTab = () => document.querySelector('#drafts-tab')?.getAttribute('aria-selected') === 'true';

export interface DraftCard {
  preview: string;
  channel: string;
  /** True when Buffer cut the preview with a trailing ellipsis inside the quotes. */
  truncated: boolean;
  schedulable: boolean;
  button: HTMLButtonElement;
}

// The preview is the quoted text. A non-greedy match stopped at the first " for " inside the post
// and at an ellipsis in the middle of it, so two different drafts could collapse into one prefix.
const EDIT = /^Edit draft "(.+)" for (.+?) created/;
const ACTION = /^(Schedule Post|Add to Queue)$/;

// A truncated preview is about 60 characters. Reverse-matching a longer query below this length
// lets a short card swallow an unrelated post ("The" matches "The quarterly update").
export const MIN_TRUNCATED_PREFIX = 12;

export function parseEditLabel(label: string): { preview: string; channel: string; truncated: boolean } | null {
  const m = label.match(EDIT);
  const quoted = m?.[1];
  const channel = m?.[2]?.trim() ?? '';
  if (!quoted || !channel) return null;
  const truncated = /…\s*$/.test(quoted);
  const preview = quoted.replace(/…\s*$/, '').trim();
  if (!preview) return null;
  return { preview, channel, truncated };
}

export function draftMatches(card: { preview: string; truncated: boolean }, query: string): boolean {
  if (card.preview.startsWith(query)) return true;
  return card.truncated && card.preview.length >= MIN_TRUNCATED_PREFIX && query.startsWith(card.preview);
}

// Pair buttons by document order: the action button is the last one seen before each Edit button.
export const readDrafts = (): DraftCard[] => {
  const out: DraftCard[] = [];
  let action: HTMLButtonElement | null = null;
  for (const b of document.querySelectorAll<HTMLButtonElement>('main button')) {
    const text = b.innerText.trim();
    if (ACTION.test(text)) {
      action = b;
      continue;
    }
    const parsed = parseEditLabel(b.getAttribute('aria-label') || text);
    if (!parsed || !action) continue;
    out.push({
      preview: parsed.preview,
      channel: parsed.channel,
      truncated: parsed.truncated,
      schedulable: action.innerText.trim() === 'Schedule Post',
      button: action,
    });
    action = null;
  }
  return out;
};

const confirmDialog = () =>
  [...document.querySelectorAll<HTMLElement>('[role=dialog]')].find(d => d.innerText.includes('will be published'));

// Click "Schedule Post", read the date Buffer shows, confirm, then verify the Queue count rose.
export const scheduleOne = async (card: DraftCard): Promise<{ ok: boolean; when: string; reason?: string }> => {
  const before = counts().queue;
  card.button.scrollIntoView({ block: 'center' });
  await sleep(300);
  card.button.click();
  let dialog: HTMLElement | undefined;
  for (let i = 0; i < 20 && !dialog; i++) {
    await sleep(150);
    dialog = confirmDialog();
  }
  if (!dialog) return { ok: false, when: '', reason: 'confirm dialog did not open' };
  const when = dialog.innerText.split('\n')[1]?.trim() ?? '';
  const confirm = [...dialog.querySelectorAll<HTMLButtonElement>('button')].find(
    b => b.innerText.trim() === 'Schedule Post',
  );
  if (!confirm) return { ok: false, when, reason: 'no confirm button in dialog' };
  confirm.click();
  for (let i = 0; i < 25; i++) {
    await sleep(200);
    if (counts().queue > before) return { ok: true, when };
  }
  return { ok: false, when, reason: 'queue count did not change' };
};
