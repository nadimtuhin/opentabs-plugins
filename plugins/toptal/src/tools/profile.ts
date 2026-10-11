import { defineTool, ToolError } from '@opentabs-dev/plugin-sdk';
import { z } from 'zod';

const onProfile = () => location.pathname.includes('/settings/profile/');
const SKIP = new Set(['hidden', 'radio', 'file']);

// Plain-text fields only; id falls back to name. Dropdowns/hidden inputs are not editable here.
const editable = () =>
  [...document.querySelectorAll<HTMLInputElement | HTMLTextAreaElement>('input, textarea')].filter(
    e => !SKIP.has(e.type) && (e.id || e.name) && !(e.tagName === 'TEXTAREA' && !e.id && !e.name),
  );
const key = (e: HTMLElement) => (e as HTMLInputElement).name || e.id;

function setNative(el: HTMLInputElement | HTMLTextAreaElement, value: string | boolean) {
  if (el instanceof HTMLInputElement && el.type === 'checkbox') {
    if (el.checked !== (value === true || value === 'true')) el.click();
    return;
  }
  value = String(value);
  const proto = el instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
  Object.getOwnPropertyDescriptor(proto, 'value')?.set?.call(el, value);
  // `blur`/`change` freeze Toptal's work-experience and portfolio forms (tab stops answering); `input` is enough.
  el.dispatchEvent(new Event('input', { bubbles: true }));
}

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

// "Save and Add Another" is excluded on purpose.
const saveButton = () =>
  [...document.querySelectorAll('button')].find(b => /^Save/.test(b.innerText.trim()) && !/Another/.test(b.innerText));

// Validation text the page shows after a failed save.
const errors = () =>
  (
    document.body.innerText.match(/[^\n]*(you need to|is required|must be|Please (select|enter|fill))[^\n]*/gi) ?? []
  ).slice(0, 5);

export const getProfileForm = defineTool({
  name: 'get_profile_form',
  displayName: 'Get Profile Form',
  description:
    'Read the editable text fields on the open Toptal profile edit page (/settings/profile/<section>): key, value, invalid flag, and the helper text (limits such as "250 to 500 characters").',
  icon: 'clipboard-list',
  input: z.object({}),
  output: z.object({
    section: z.string(),
    fields: z.array(
      z.object({ key: z.string(), type: z.string(), value: z.string(), checked: z.boolean(), invalid: z.boolean() }),
    ),
    hints: z.array(z.string()),
    save_button: z.string(),
  }),
  handle: async () => {
    if (!onProfile()) throw ToolError.notFound('Open a /settings/profile/<section> edit page first.');
    return {
      section: location.pathname.split('/').pop() ?? '',
      fields: editable().map(e => ({
        key: key(e),
        type: e.type,
        value: e.type === 'checkbox' ? '' : e.value,
        checked: e instanceof HTMLInputElement && e.checked,
        invalid: e.getAttribute('aria-invalid') === 'true',
      })),
      hints: (document.body.innerText.match(/[^\n]*(between \d+ and \d+|characters|Important:)[^\n]*/g) ?? []).slice(
        0,
        10,
      ),
      save_button: saveButton()?.innerText.trim() ?? '',
    };
  },
});

export const fillProfileFields = defineTool({
  name: 'fill_profile_fields',
  displayName: 'Fill Profile Fields',
  description:
    "Set text fields (string) and checkboxes (true/false) on the open Toptal profile edit page by key (see get_profile_form). Does not save. Consent checkboxes (SMS, publication permit) must only be ticked with the user's say-so.",
  icon: 'pencil',
  input: z.object({ fields: z.record(z.string(), z.union([z.string(), z.boolean()])).describe('key -> new value') }),
  output: z.object({ set: z.array(z.string()), invalid: z.array(z.string()) }),
  handle: async ({ fields }) => {
    if (!onProfile()) throw ToolError.notFound('Open a /settings/profile/<section> edit page first.');
    const els = new Map(editable().map(e => [key(e), e]));
    const missing = Object.keys(fields).filter(k => !els.has(k));
    if (missing.length) throw ToolError.validation(`Unknown field keys: ${missing.join(', ')}`);
    for (const [k, v] of Object.entries(fields)) setNative(els.get(k) as HTMLInputElement, v);
    await new Promise(r => setTimeout(r, 400));
    return {
      set: Object.keys(fields),
      invalid: Object.keys(fields).filter(k => els.get(k)?.getAttribute('aria-invalid') === 'true'),
    };
  },
});

export const saveProfile = defineTool({
  name: 'save_profile',
  displayName: 'Save Profile Section',
  description:
    'Click the Save button on the open Toptal profile edit page. Refuses if any field is flagged invalid. Returns the resulting URL.',
  icon: 'save',
  input: z.object({}),
  output: z.object({ url: z.string(), saved: z.boolean(), invalid: z.array(z.string()), errors: z.array(z.string()) }),
  handle: async () => {
    if (!onProfile()) throw ToolError.notFound('Open a /settings/profile/<section> edit page first.');
    const bad = editable()
      .filter(e => e.getAttribute('aria-invalid') === 'true')
      .map(key);
    if (bad.length) throw ToolError.validation(`Invalid fields, not saving: ${bad.join(', ')}`);
    const btn = saveButton();
    if (!btn) throw ToolError.notFound('No Save button on this page.');
    const before = location.href;
    btn.click();
    // The redirect after a save can take over 3s; poll instead of a fixed sleep.
    for (let i = 0; i < 16 && location.href === before; i++) await sleep(500);
    const invalid = editable()
      .filter(e => e.getAttribute('aria-invalid') === 'true')
      .map(key);
    const saved = location.href !== before && invalid.length === 0;
    return { url: location.href, saved, invalid, errors: saved ? [] : errors() };
  },
});

// Type-ahead picker (industryIds, skills): click, set text with the native setter + `input`, click the matching option.
// The first open on a fresh form is often empty, so retry once before reporting a miss.
export const pickOption = defineTool({
  name: 'pick_option',
  displayName: 'Pick Type-ahead Option',
  description:
    'Select one option in a Toptal type-ahead picker (field name industryIds or skills) by exact label. Call once per option. Fails if the label is not in Toptal\'s fixed list (e.g. no Gutenberg or WooCommerce).',
  icon: 'list-checks',
  input: z.object({ field: z.enum(['industryIds', 'skills']), label: z.string() }),
  output: z.object({ picked: z.boolean(), seen: z.array(z.string()) }),
  handle: async ({ field, label }) => {
    if (!onProfile()) throw ToolError.notFound('Open a /settings/profile/<section> edit page first.');
    const el = document.querySelector<HTMLInputElement>(`[name="${field}"]`);
    if (!el) throw ToolError.notFound(`No ${field} input on this page.`);
    let seen: string[] = [];
    for (let attempt = 0; attempt < 2; attempt++) {
      el.focus();
      el.click();
      await sleep(800);
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set?.call(el, label);
      el.dispatchEvent(new Event('input', { bubbles: true }));
      await sleep(1500);
      const opts = [...document.querySelectorAll<HTMLElement>('[role=option]')];
      seen = opts.map(o => o.innerText.trim()).slice(0, 6);
      const hit = opts.find(o => o.innerText.trim() === label);
      if (hit) {
        for (const t of ['pointerdown', 'mousedown', 'pointerup', 'mouseup', 'click'])
          hit.dispatchEvent(new MouseEvent(t, { bubbles: true, cancelable: true, view: window }));
        await sleep(300);
        return { picked: true, seen };
      }
    }
    return { picked: false, seen };
  },
});

// Work-experience dates are year-only YearSelect components that ignore typed text: call their onChange prop.
export const setYear = defineTool({
  name: 'set_year',
  displayName: 'Set Year',
  description: 'Set the startDate or endDate year on a Toptal work-experience form.',
  icon: 'calendar',
  input: z.object({ field: z.enum(['startDate', 'endDate']), year: z.number().int().min(1970).max(2100) }),
  output: z.object({ value: z.string() }),
  handle: async ({ field, year }) => {
    const el = document.getElementById(field);
    if (!el) throw ToolError.notFound(`No #${field} on this page.`);
    const fk = Object.keys(el).find(k => k.startsWith('__reactFiber'));
    // biome-ignore lint/suspicious/noExplicitAny: React fiber internals
    let f: any = fk ? (el as any)[fk] : null;
    for (let i = 0; f && i < 10 && f.type?.name !== 'YearSelect' && f.type?.displayName !== 'YearSelect'; i++) f = f.return;
    if (!f) throw ToolError.internal('YearSelect component not found.');
    f.memoizedProps.onChange(year);
    await sleep(500);
    return { value: (document.getElementById(field) as HTMLInputElement).value };
  },
});
