import { defineTool, ToolError } from '@opentabs-dev/plugin-sdk';
import { z } from 'zod';
import {
  alerts,
  dialog,
  dialogButton,
  menuItems,
  clickItem,
  setNative,
  sleep,
  tokens,
  typeInto,
} from '../upwork-dom.js';

const onProfile = () => /\/freelancers\/~/.test(location.pathname);

// Section name -> aria-label of the pencil button on the profile page.
const EDIT_BUTTON: Record<string, string> = {
  title: 'Edit title',
  overview: 'Edit description',
  skills: 'Edit skills',
};

async function openEditor(section: string) {
  if (!onProfile()) throw ToolError.notFound('Open https://www.upwork.com/freelancers/~<id> first.');
  const btn = document.querySelector<HTMLElement>(`button[aria-label='${EDIT_BUTTON[section]}']`);
  if (!btn) throw ToolError.notFound(`No "${EDIT_BUTTON[section]}" button on this page.`);
  btn.scrollIntoView({ block: 'center' });
  btn.click();
  await sleep(2800);
  const d = dialog();
  if (!d) throw ToolError.internal('Editor dialog did not open. Keep the Upwork tab in front and retry.');
  return d;
}

// Upwork saves in the background (~25s). Reload and read the page to verify.
async function save(): Promise<string[]> {
  const b = dialogButton('Save');
  if (!b) throw ToolError.internal('No Save button in the dialog.');
  if (b.disabled) throw ToolError.validation('Save is disabled. A required field is empty or invalid.');
  b.click();
  await sleep(1500);
  return alerts();
}

export const getProfile = defineTool({
  name: 'get_profile',
  displayName: 'Get Profile',
  description:
    'Read the open Upwork freelancer profile page (/freelancers/~<id>): title, hourly rate, overview, skills, employment history lines, portfolio titles.',
  icon: 'user',
  input: z.object({}),
  output: z.object({
    title: z.string(),
    rate: z.string(),
    overview: z.string(),
    skills: z.array(z.string()),
    employment: z.array(z.string()),
  }),
  handle: async () => {
    if (!onProfile()) throw ToolError.notFound('Open https://www.upwork.com/freelancers/~<id> first.');
    const text = document.body.innerText;
    const after = (head: string, until: string) => {
      const i = text.lastIndexOf(`${head}\n`);
      if (i < 0) return '';
      const rest = text.slice(i + head.length + 1);
      const j = rest.indexOf(until);
      return (j < 0 ? rest : rest.slice(0, j)).trim();
    };
    const lines = text.split('\n');
    const ri = lines.findIndex(l => /^\$\d+\.\d\d\/hr/.test(l.trim()));
    const moreAt = lines.findIndex((l, i) => i > ri && l.trim() === 'more');
    return {
      title: ri > 0 ? (lines[ri - 1] ?? '').trim() : '',
      rate: ri >= 0 ? (lines[ri] ?? '').trim() : '',
      overview:
        ri >= 0 && moreAt > ri
          ? lines
              .slice(ri + 1, moreAt)
              .join('\n')
              .trim()
          : '',
      skills: after('Skills', 'Your project catalog')
        .split('\n')
        .map(s => s.trim())
        .filter(Boolean),
      employment: after('Employment history', 'Other experiences')
        .split('\n')
        .map(s => s.trim())
        .filter(s => s && !/^(more|Show more|\(\d+\))$/.test(s)),
    };
  },
});

export const setProfileText = defineTool({
  name: 'set_profile_text',
  displayName: 'Set Profile Text',
  description:
    'Replace the profile title (max 70 chars) or overview (max 5000, no URLs allowed by Upwork) and click Save. Upwork applies it in ~25 seconds; reload to verify.',
  icon: 'pencil',
  input: z.object({
    section: z.enum(['title', 'overview']),
    text: z.string().min(1),
  }),
  output: z.object({ saved: z.boolean(), alerts: z.array(z.string()) }),
  handle: async ({ section, text }) => {
    if (section === 'title' && text.length > 70) throw ToolError.validation('Title is limited to 70 characters.');
    if (section === 'overview' && /https?:\/\//i.test(text))
      throw ToolError.validation('Upwork rejects links in the overview. Put links in Portfolio.');
    const d = await openEditor(section);
    const el =
      section === 'title'
        ? d.querySelector<HTMLInputElement>('#profile-title')
        : d.querySelector<HTMLTextAreaElement>('textarea');
    if (!el) throw ToolError.notFound('Input not found in the dialog.');
    setNative(el, text);
    await sleep(500);
    return { saved: true, alerts: await save() };
  },
});

export const setSkills = defineTool({
  name: 'set_skills',
  displayName: 'Set Skills',
  description:
    'Make the profile skills exactly the given list (max 20). Removes skills not in the list, searches each missing skill on Upwork and adds the exact-name match. Skills Upwork does not list are reported in `not_found`. Clicks Save only if nothing was missing.',
  icon: 'tags',
  input: z.object({ skills: z.array(z.string().min(1)).min(1).max(20) }),
  output: z.object({ final: z.array(z.string()), not_found: z.array(z.string()), saved: z.boolean() }),
  handle: async ({ skills }) => {
    const d = await openEditor('skills');
    const want = new Set(skills.map(s => s.toLowerCase()));
    const before = tokens(d);
    if (before.length === 0) throw ToolError.internal('Skills list read empty; aborting without changes.');
    for (const s of before) {
      if (want.has(s.toLowerCase())) continue;
      [...d.querySelectorAll<HTMLButtonElement>('button.air3-token-remove')]
        .find(b => b.innerText.trim() === `Remove ${s} Tag`)
        ?.click();
      await sleep(250);
    }
    const input = d.querySelector<HTMLInputElement>('input[type=search]');
    if (!input) throw ToolError.notFound('Skill search box not found.');
    const missing: string[] = [];
    for (const s of skills) {
      if (tokens(d).some(t => t.toLowerCase() === s.toLowerCase())) continue;
      [...d.querySelectorAll('button')].find(b => /Clear Input/.test(b.innerText))?.click();
      await sleep(250);
      await typeInto(input, s, 1700);
      const ok = await clickItem(
        menuItems(document.getElementById(input.getAttribute('aria-controls') ?? '') ?? document),
        s,
      );
      if (!ok) missing.push(s);
    }
    const final = tokens(d);
    if (missing.length) return { final, not_found: missing, saved: false };
    await save();
    return { final, not_found: [], saved: true };
  },
});

export const setCategories = defineTool({
  name: 'set_categories',
  displayName: 'Set Categories',
  description:
    'On /freelancers/settings/profile, make the selected categories exactly the given list (max 10), by their sub-category names (e.g. "AI Apps & Integration", "Web Development") and click Save.',
  icon: 'folder',
  input: z.object({ categories: z.array(z.string().min(1)).min(1).max(10) }),
  output: z.object({ checked: z.array(z.string()), unknown: z.array(z.string()), saved: z.boolean() }),
  handle: async ({ categories }) => {
    if (!location.pathname.includes('/settings/profile'))
      throw ToolError.notFound('Open https://www.upwork.com/freelancers/settings/profile first.');
    document.querySelector<HTMLElement>('button[aria-labelledby=editCategoryLabel]')?.click();
    await sleep(3000);
    const d = dialog();
    if (!d) throw ToolError.internal('Category dialog did not open. Keep the tab in front and retry.');
    const boxes = [...d.querySelectorAll<HTMLInputElement>('input[type=checkbox]')];
    const nameOf = (c: HTMLInputElement) => ((c.closest('label') ?? c.parentElement)?.textContent ?? '').trim();
    const want = new Set(categories.map(c => c.toLowerCase()));
    const unknown = categories.filter(c => !boxes.some(b => nameOf(b).toLowerCase() === c.toLowerCase()));
    if (unknown.length) return { checked: boxes.filter(b => b.checked).map(nameOf), unknown, saved: false };
    for (const b of boxes) {
      if (b.checked !== want.has(nameOf(b).toLowerCase())) {
        b.click();
        await sleep(400);
      }
    }
    const checked = boxes.filter(b => b.checked).map(nameOf);
    await save();
    return { checked, unknown: [], saved: true };
  },
});
