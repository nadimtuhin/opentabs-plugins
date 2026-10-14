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
  schedulable: boolean;
  button: HTMLButtonElement;
}

const EDIT = /^Edit draft "(.+?)…?" for (.+?) created/;
const ACTION = /^(Schedule Post|Add to Queue)$/;

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
    const m = (b.getAttribute('aria-label') || text).match(EDIT);
    if (!m || !action) continue;
    out.push({
      preview: m[1] ?? '',
      channel: m[2] ?? '',
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
