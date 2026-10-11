// Shared DOM helpers for Upwork's air3 widgets. Learned by hand against the live profile (Oct 2026).
// ponytail: scripted clicks can break when Upwork renames air3 classes; re-check selectors then.

export const sleep = (ms: number) => new Promise<void>(r => setTimeout(r, ms));

export const dialog = (): HTMLElement | null => document.querySelector<HTMLElement>('[role=dialog]');

export const fire = (el: Element, type: string) =>
  el.dispatchEvent(new MouseEvent(type, { bubbles: true, cancelable: true, view: window }));

export function setNative(el: HTMLInputElement | HTMLTextAreaElement, value: string) {
  const proto = el instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
  Object.getOwnPropertyDescriptor(proto, 'value')?.set?.call(el, value);
  for (const t of ['input', 'change', 'blur']) el.dispatchEvent(new Event(t, { bubbles: true }));
}

// Typeahead inputs only react to real focus + insertText, not to the native value setter.
export async function typeInto(input: HTMLInputElement, text: string, waitMs = 1400) {
  fire(input, 'mousedown');
  input.focus();
  fire(input, 'mouseup');
  fire(input, 'click');
  await sleep(250);
  input.select();
  document.execCommand('delete');
  document.execCommand('insertText', false, text);
  await sleep(waitMs);
}

export function menuItems(scope: ParentNode = document): HTMLElement[] {
  return [...scope.querySelectorAll<HTMLElement>('li.air3-menu-item, [role=option]')].filter(
    o => o.offsetParent !== null,
  );
}

export async function clickItem(items: HTMLElement[], label: string): Promise<boolean> {
  const hit = items.find(
    o =>
      o.innerText
        .trim()
        .replace(/\s*selected$/, '')
        .toLowerCase() === label.toLowerCase(),
  );
  if (!hit) return false;
  (hit.querySelector<HTMLElement>('a, button') ?? hit).click();
  await sleep(500);
  return true;
}

// air3 dropdown (month/year/etc): open with real mouse events, pick from its own menu.
export async function pickDropdown(labelId: string, label: string): Promise<boolean> {
  const d = dialog();
  const t = d?.querySelector<HTMLElement>(`[aria-labelledby=${labelId}][role=combobox]`);
  if (!t) return false;
  if (t.getAttribute('aria-expanded') === 'true') {
    t.click();
    await sleep(300);
  }
  fire(t, 'mousedown');
  fire(t, 'mouseup');
  t.click();
  await sleep(800);
  const menu = t.closest('.air3-dropdown');
  return clickItem(menuItems(menu ?? document), label);
}

export const tokens = (scope: ParentNode): string[] =>
  [...scope.querySelectorAll<HTMLElement>('button.air3-token-remove')].map(b =>
    b.innerText
      .trim()
      .replace(/^Remove /, '')
      .replace(/ Tag$/, ''),
  );

export const dialogButton = (text: string): HTMLButtonElement | undefined =>
  [...(dialog()?.querySelectorAll('button') ?? [])].find(b => b.innerText.trim() === text);

export const alerts = (): string[] =>
  [...document.querySelectorAll<HTMLElement>('[role=alert]')].map(e => e.innerText.trim()).filter(Boolean);
