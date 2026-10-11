// DOM helpers for the hosted Greenhouse job board form (job-boards.greenhouse.io).
// Dropdowns are react-select: their menus only open on trusted mouse events, so values
// are set through the component instance found on the React fiber.

export type FieldType = 'text' | 'textarea' | 'select' | 'checkboxes' | 'file';

export interface FormField {
  id: string;
  label: string;
  type: FieldType;
  required: boolean;
  value: string | string[];
  options: string[];
}

interface SelectOption {
  label: string;
  value: unknown;
  options?: SelectOption[];
}

interface SelectInstance {
  props: { options?: SelectOption[]; isMulti?: boolean; value?: SelectOption | SelectOption[] | null };
  selectOption: (option: SelectOption) => void;
}

const clean = (s: string | null | undefined): string => (s ?? '').replace(/\s+/g, ' ').replace(/\*$/, '').trim();

export const getForm = (): HTMLFormElement | null =>
  document.querySelector<HTMLFormElement>('form#application-form, form.application--form');

const labelFor = (el: HTMLElement): string => {
  const byFor = el.id ? document.querySelector(`label[for="${CSS.escape(el.id)}"]`) : null;
  if (byFor) return clean(byFor.textContent);
  const by = el.getAttribute('aria-labelledby');
  if (by) return clean(document.getElementById(by)?.textContent);
  return clean(el.getAttribute('aria-label') ?? el.closest('fieldset')?.querySelector('legend')?.textContent);
};

const selectInstance = (input: HTMLElement): SelectInstance | null => {
  const key = Object.keys(input).find(k => k.startsWith('__reactFiber$'));
  // biome-ignore lint/suspicious/noExplicitAny: walking React internals
  let fiber: any = key ? (input as any)[key] : null;
  while (fiber) {
    const s = fiber.stateNode;
    if (s && typeof s.selectOption === 'function' && s.props) return s as SelectInstance;
    fiber = fiber.return;
  }
  return null;
};

const flatOptions = (opts: SelectOption[] = []): SelectOption[] => opts.flatMap(o => o.options ?? [o]);

const selectedLabels = (input: HTMLElement): string[] => {
  const box = input.closest('.select__container, .select-shell');
  return [...(box?.querySelectorAll('.select__single-value, .select__multi-value__label') ?? [])].map(e =>
    clean(e.textContent),
  );
};

export const readFields = (): FormField[] => {
  const form = getForm();
  if (!form) return [];
  const fields: FormField[] = [];
  const seenGroups = new Set<string>();

  for (const el of form.querySelectorAll<HTMLInputElement | HTMLTextAreaElement>('input, textarea')) {
    if (el.type === 'hidden' || el.type === 'search' || !el.id) continue;
    const required = el.required || el.getAttribute('aria-required') === 'true';

    if (el.getAttribute('role') === 'combobox' && el.classList.contains('select__input')) {
      const inst = selectInstance(el);
      fields.push({
        id: el.id,
        label: labelFor(el),
        type: 'select',
        required,
        value: selectedLabels(el),
        options: inst ? flatOptions(inst.props.options).map(o => clean(o.label)) : [],
      });
    } else if (el.type === 'checkbox') {
      const group = el.name || el.id.replace(/_\d+$/, '');
      if (seenGroups.has(group)) continue;
      seenGroups.add(group);
      const boxes = [...form.querySelectorAll<HTMLInputElement>(`input[type=checkbox][name="${CSS.escape(group)}"]`)];
      const list = boxes.length ? boxes : [el as HTMLInputElement];
      fields.push({
        id: group,
        label: clean(el.closest('fieldset')?.querySelector('legend')?.textContent) || labelFor(el),
        type: 'checkboxes',
        required: list.some(b => b.required || b.getAttribute('aria-required') === 'true'),
        value: list.filter(b => b.checked).map(labelFor),
        options: list.map(labelFor),
      });
    } else if (el.type === 'file') {
      const label = clean(document.getElementById(`upload-label-${el.id}`)?.textContent) || el.id;
      fields.push({ id: el.id, label, type: 'file', required, value: [], options: [] });
    } else {
      fields.push({
        id: el.id,
        label: labelFor(el),
        type: el.tagName === 'TEXTAREA' ? 'textarea' : 'text',
        required,
        value: el.value,
        options: [],
      });
    }
  }
  return fields;
};

/** Finds a field by exact id, then by case-insensitive label substring, then by all words of the key appearing in the label. */
export const findField = (key: string): FormField | null => {
  const fields = readFields();
  const k = key.toLowerCase();
  const words = k.split(/\s+/).filter(Boolean);
  return (
    fields.find(f => f.id === key) ??
    fields.find(f => f.label.toLowerCase().includes(k)) ??
    fields.find(f => words.every(w => f.label.toLowerCase().includes(w))) ??
    null
  );
};

const matchOption = (options: string[], want: string): string | null => {
  const w = want.toLowerCase().trim();
  return (
    options.find(o => o.toLowerCase() === w) ??
    options.find(o => o.toLowerCase().startsWith(w)) ??
    options.find(o => o.toLowerCase().includes(w)) ??
    null
  );
};

const setText = (el: HTMLInputElement | HTMLTextAreaElement, value: string): void => {
  const proto = el instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
  Object.getOwnPropertyDescriptor(proto, 'value')?.set?.call(el, value);
  for (const t of ['input', 'change', 'blur']) el.dispatchEvent(new Event(t, { bubbles: true }));
};

/** Applies one answer. Returns the value now shown in the form, or throws with a reason. */
export const applyAnswer = (field: FormField, value: string | string[]): string | string[] => {
  const values = Array.isArray(value) ? value : [value];

  if (field.type === 'text' || field.type === 'textarea') {
    const el = document.getElementById(field.id) as HTMLInputElement | HTMLTextAreaElement;
    setText(el, values.join(', '));
    return el.value;
  }

  if (field.type === 'select') {
    const input = document.getElementById(field.id) as HTMLElement;
    const inst = selectInstance(input);
    if (!inst) throw new Error('dropdown component not found');
    const opts = flatOptions(inst.props.options);
    if (opts.length === 0) throw new Error('dropdown loads options from a search; fill it by hand');
    for (const v of values) {
      const label = matchOption(
        opts.map(o => clean(o.label)),
        v,
      );
      if (!label) throw new Error(`no option matching "${v}"`);
      const opt = opts.find(o => clean(o.label) === label);
      if (opt) inst.selectOption(opt);
      if (!inst.props.isMulti) break;
    }
    return selectedLabels(input);
  }

  if (field.type === 'checkboxes') {
    const form = getForm();
    const boxes = [
      ...(form?.querySelectorAll<HTMLInputElement>(`input[type=checkbox][name="${CSS.escape(field.id)}"]`) ?? []),
    ];
    const wanted = values.map(v => matchOption(field.options, v));
    const missing = values.filter((_, i) => !wanted[i]);
    if (missing.length) throw new Error(`no option matching "${missing.join('", "')}"`);
    for (const b of boxes) {
      const should = wanted.includes(labelFor(b));
      if (b.checked !== should) b.click();
    }
    return boxes.filter(b => b.checked).map(labelFor);
  }

  throw new Error('file fields need attach_file');
};
