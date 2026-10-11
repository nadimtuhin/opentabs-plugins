import { defineTool, sleep, ToolError } from '@opentabs-dev/plugin-sdk';
import { z } from 'zod';
import { getForm } from '../greenhouse-form.js';

const MAX_BYTES = 10 * 1024 * 1024;

export const attachFile = defineTool({
  name: 'attach_file',
  displayName: 'Attach File',
  description:
    'Attach a resume or cover letter to the Greenhouse form. Pass the file as base64 (PDF, DOC, DOCX, TXT or RTF, up to 10 MB).',
  icon: 'paperclip',
  input: z.object({
    field: z.enum(['resume', 'cover_letter']),
    filename: z.string().regex(/\.(pdf|docx?|txt|rtf)$/i, 'filename must end in .pdf, .doc, .docx, .txt or .rtf'),
    content_base64: z.string().min(1),
  }),
  output: z.object({ attached: z.boolean(), shown_as: z.string() }),
  handle: async ({ field, filename, content_base64 }) => {
    if (!getForm()) throw ToolError.notFound('No Greenhouse application form on this page.');
    const input = document.getElementById(field) as HTMLInputElement | null;
    if (!input || input.type !== 'file') {
      throw ToolError.validation(`No empty ${field} upload field. Remove the attached file first.`);
    }

    const bin = atob(content_base64);
    if (bin.length > MAX_BYTES) throw ToolError.validation('File is larger than 10 MB.');
    const bytes = Uint8Array.from(bin, c => c.charCodeAt(0));
    const type = filename.toLowerCase().endsWith('.pdf') ? 'application/pdf' : 'application/octet-stream';
    const dt = new DataTransfer();
    dt.items.add(new File([bytes], filename, { type }));
    const wrapper = input.closest('.field-wrapper, .file-upload') ?? input.parentElement;
    input.files = dt.files;
    input.dispatchEvent(new Event('change', { bubbles: true }));

    for (let i = 0; i < 20; i++) {
      await sleep(250);
      if (wrapper?.textContent?.includes(filename)) return { attached: true, shown_as: filename };
    }
    return { attached: false, shown_as: '' };
  },
});
