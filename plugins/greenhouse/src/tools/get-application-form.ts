import { defineTool, ToolError } from '@opentabs-dev/plugin-sdk';
import { z } from 'zod';
import { getForm, readFields } from '../greenhouse-form.js';

const fieldSchema = z.object({
  id: z.string().describe('Field id, usable as a key in fill_application'),
  label: z.string(),
  type: z.enum(['text', 'textarea', 'select', 'checkboxes', 'file']),
  required: z.boolean(),
  value: z.union([z.string(), z.array(z.string())]).describe('Current value'),
  options: z.array(z.string()).describe('Choices for select and checkboxes fields'),
});

export const getApplicationForm = defineTool({
  name: 'get_application_form',
  displayName: 'Get Application Form',
  description:
    'Read the Greenhouse application form on the current job page: job title, every field with its label, type, required flag, current value and dropdown options, and which required fields are still empty.',
  icon: 'clipboard-list',
  input: z.object({}),
  output: z.object({
    job_title: z.string(),
    url: z.string(),
    fields: z.array(fieldSchema),
    missing_required: z.array(z.string()).describe('Labels of required fields that are still empty'),
  }),
  handle: async () => {
    if (!getForm()) throw ToolError.notFound('No Greenhouse application form on this page. Open a job page first.');
    const fields = readFields();
    return {
      job_title: (document.querySelector('h1')?.textContent ?? document.title).trim(),
      url: location.href,
      fields,
      missing_required: fields
        .filter(f => f.required && (Array.isArray(f.value) ? f.value.length === 0 : f.value.trim() === ''))
        .map(f => f.label),
    };
  },
});
