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

// Skills page (/settings/profile/skills). Proficiency and years are React selects that ignore typed text: call onChange.
const onSkills = () => location.pathname.endsWith('/settings/profile/skills');
const buttonByText = (t: string) => [...document.querySelectorAll('button')].find(b => b.innerText.trim() === t);
const skillNames = () =>
  [...document.querySelectorAll<HTMLElement>('[data-testid="SkillsFormSkillName"]')].map(e => e.title);
const fire = (el: Element) => {
  for (const t of ['pointerdown', 'mousedown', 'pointerup', 'mouseup', 'click'])
    el.dispatchEvent(new MouseEvent(t, { bubbles: true, cancelable: true, view: window }));
};
// biome-ignore lint/suspicious/noExplicitAny: React fiber internals
function selectProps(el: Element): any {
  const fk = Object.keys(el).find(k => k.startsWith('__reactFiber'));
  // biome-ignore lint/suspicious/noExplicitAny: React fiber internals
  let f: any = fk ? (el as any)[fk] : null;
  for (let i = 0; f && i < 40; i++, f = f.return)
    if (typeof f.memoizedProps?.onChange === 'function' && f.memoizedProps.options) return f.memoizedProps;
  throw ToolError.internal('Select component not found.');
}
// "Done" persists the table and redirects to /settings/profile. Right after "Add Skill" the first click is ignored: wait, retry once.
async function clickDone() {
  for (let attempt = 0; attempt < 2 && onSkills(); attempt++) {
    await sleep(1000);
    const done = buttonByText('Done');
    if (!done) throw ToolError.notFound('No Done button.');
    done.click();
    for (let i = 0; i < 12 && onSkills(); i++) await sleep(500);
  }
  return !onSkills();
}
const SKILLS_ONLY = 'Open /talent/<id>/settings/profile/skills first (reload it between calls).';

// ponytail: one skill per call. After one add, the picker shows no options until the page reloads.
export const addSkill = defineTool({
  name: 'add_skill',
  displayName: 'Add Skill',
  description:
    'Add one skill on the Toptal Skills page with proficiency and years, then click Done to save. Reload the Skills page before the next call. Label must exactly match Toptal\'s list (e.g. "Jira REST API").',
  icon: 'plus',
  input: z.object({
    name: z.string().min(1),
    proficiency: z.enum(['COMPETENT', 'STRONG', 'EXPERT']),
    years: z.number().int().min(1).max(20),
  }),
  output: z.object({ added: z.boolean(), saved: z.boolean(), seen: z.array(z.string()) }),
  handle: async ({ name, proficiency, years }) => {
    if (!onSkills()) throw ToolError.notFound(SKILLS_ONLY);
    // Page may still be hydrating right after navigation.
    for (let i = 0; i < 20 && !buttonByText('Add a skill'); i++) await sleep(500);
    if (skillNames().includes(name)) throw ToolError.validation(`${name} is already on the profile.`);
    buttonByText('Add a skill')?.click();
    await sleep(800);
    const inp = document.querySelector<HTMLInputElement>('input[placeholder="Add Skill"]');
    if (!inp) throw ToolError.notFound('No Add Skill input. Reload the Skills page.');
    inp.focus();
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set?.call(inp, name);
    inp.dispatchEvent(new Event('input', { bubbles: true }));
    // Search is server-side and can take several seconds; poll for the exact option.
    let opts: HTMLElement[] = [];
    for (let i = 0; i < 16; i++) {
      await sleep(500);
      opts = [...document.querySelectorAll<HTMLElement>('[role=option]')];
      if (opts.some(o => o.innerText.trim() === name)) break;
    }
    const seen = opts.map(o => o.innerText.trim()).slice(0, 8);
    const hit = opts.find(o => o.innerText.trim() === name);
    if (!hit) return { added: false, saved: false, seen };
    fire(hit);
    await sleep(800);
    const prof = document.querySelector('input[placeholder="Select proficiency"]');
    const yrs = document.querySelector('input[placeholder="Select years"]');
    if (!prof || !yrs) throw ToolError.notFound('Proficiency/years selects missing.');
    selectProps(prof).onChange(proficiency);
    await sleep(300);
    selectProps(yrs).onChange(years);
    await sleep(400);
    buttonByText('Add Skill')?.click();
    for (let i = 0; i < 8 && !skillNames().includes(name); i++) await sleep(500);
    if (!skillNames().includes(name)) return { added: false, saved: false, seen };
    return { added: true, saved: await clickDone(), seen };
  },
});

// The delete button enables only after mouseover + mouseenter on the row, then a click on the name.
export const removeSkill = defineTool({
  name: 'remove_skill',
  displayName: 'Remove Skill',
  description:
    'Remove one skill by exact name on the Toptal Skills page, then click Done to save. Reload the Skills page before the next call.',
  icon: 'trash',
  input: z.object({ name: z.string().min(1) }),
  output: z.object({ removed: z.boolean(), saved: z.boolean() }),
  handle: async ({ name }) => {
    if (!onSkills()) throw ToolError.notFound(SKILLS_ONLY);
    const row = [...document.querySelectorAll<HTMLElement>('[data-testid="SkillsFormSkillEditRow"]')].find(
      r => r.querySelector<HTMLElement>('[data-testid="SkillsFormSkillName"]')?.title === name,
    );
    if (!row) throw ToolError.notFound(`${name} is not on the profile.`);
    const del = row.querySelector<HTMLButtonElement>('[data-testid="skills-form-delete-skill-button"]');
    // Flaky right after page load: retry hover + click.
    for (let i = 0; i < 4 && del?.disabled; i++) {
      row.dispatchEvent(new MouseEvent('mouseover', { bubbles: true }));
      row.dispatchEvent(new MouseEvent('mouseenter', { bubbles: true }));
      await sleep(400);
      row.querySelector<HTMLElement>('[data-testid="SkillsFormSkillName"]')?.click();
      await sleep(600);
    }
    if (!del || del.disabled) throw ToolError.internal('Delete button stayed disabled.');
    del.click();
    await sleep(800);
    // A confirm dialog may appear.
    const confirm = [...document.querySelectorAll<HTMLButtonElement>('[role=dialog] button')].find(b =>
      /^(Delete|Remove|Yes|Confirm)/i.test(b.innerText.trim()),
    );
    if (confirm) {
      confirm.click();
      await sleep(800);
    }
    // The row disappears after a short delay; poll.
    for (let i = 0; i < 8 && skillNames().includes(name); i++) await sleep(500);
    if (skillNames().includes(name)) return { removed: false, saved: false };
    return { removed: true, saved: await clickDone() };
  },
});
