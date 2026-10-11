import { defineTool, sleep, ToolError } from '@opentabs-dev/plugin-sdk';
import { z } from 'zod';
import { applyAnswer, findField, getForm, readFields } from '../greenhouse-form.js';

export const fillApplication = defineTool({
  name: 'fill_application',
  displayName: 'Fill Application',
  description:
    'Fill fields on the Greenhouse application form. Keys are field ids or a part of the label (case-insensitive). Dropdown and checkbox values match an option exactly, then by prefix, then by substring. Never submits: the user reviews and clicks Submit.',
  icon: 'pen-line',
  input: z.object({
    answers: z
      .record(z.string(), z.union([z.string(), z.array(z.string())]))
      .describe('Map of field id or label text to value. Use an array for multi-select checkboxes.'),
  }),
  output: z.object({
    filled: z.array(
      z.object({ key: z.string(), label: z.string(), value: z.union([z.string(), z.array(z.string())]) }),
    ),
    failed: z.array(z.object({ key: z.string(), error: z.string() })),
    missing_required: z.array(z.string()),
  }),
  handle: async ({ answers }) => {
    if (!getForm()) throw ToolError.notFound('No Greenhouse application form on this page.');
    const filled: { key: string; id: string; label: string; value: string | string[] }[] = [];
    const failed: { key: string; error: string }[] = [];

    for (const [key, value] of Object.entries(answers)) {
      const field = findField(key);
      if (!field) {
        failed.push({ key, error: 'no field with this id or label' });
        continue;
      }
      try {
        applyAnswer(field, value);
        filled.push({ key, id: field.id, label: field.label, value: '' });
      } catch (e) {
        failed.push({ key, error: e instanceof Error ? e.message : String(e) });
      }
      await sleep(120);
    }

    // react-select renders the chosen value on the next frame, so read back after a pause.
    await sleep(400);
    const after = readFields();
    for (const f of filled) f.value = after.find(a => a.id === f.id)?.value ?? '';
    const missing_required = after
      .filter(f => f.required && (Array.isArray(f.value) ? f.value.length === 0 : f.value.trim() === ''))
      .map(f => f.label);
    return { filled: filled.map(({ id: _id, ...rest }) => rest), failed, missing_required };
  },
});
