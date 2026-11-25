import { defineTool, ToolError } from '@opentabs-dev/plugin-sdk';
import { z } from 'zod';
import { COVER_MAX, COVER_MIN, applyStep, coverLetterError } from '../form-rules.js';

const pitchBox = () => document.querySelector<HTMLTextAreaElement>('textarea[name="pitch"]');
const rateBox = () => document.querySelector<HTMLInputElement>('input[name="requestedRate"]');
const termsBox = () => document.querySelector<HTMLInputElement>('input[name="understand"]');

// React ignores plain .value assignment; use the native setter, then fire events.
function setNative(el: HTMLInputElement | HTMLTextAreaElement, value: string) {
  const proto = el instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
  Object.getOwnPropertyDescriptor(proto, 'value')?.set?.call(el, value);
  el.dispatchEvent(new Event('input', { bubbles: true }));
  el.dispatchEvent(new Event('change', { bubbles: true }));
  el.dispatchEvent(new Event('blur', { bubbles: true }));
}

const step = () => applyStep(Boolean(pitchBox()), Boolean(rateBox()));

export const getApplyState = defineTool({
  name: 'get_apply_state',
  displayName: 'Get Apply State',
  description:
    'Read the Toptal apply page: job title, current wizard step (rate, cover_letter, other), rate, cover letter length and terms checkbox.',
  icon: 'clipboard-list',
  input: z.object({}),
  output: z.object({
    title: z.string(),
    step: z.string(),
    rate: z.string(),
    pitch_length: z.number(),
    terms_checked: z.boolean(),
  }),
  handle: async () => {
    if (!location.pathname.includes('/apply')) throw ToolError.notFound('Not on a Toptal /apply page.');
    return {
      title: document.title.split('. Talent Portal')[0] ?? '',
      step: step(),
      rate: rateBox()?.value ?? '',
      pitch_length: pitchBox()?.value.length ?? 0,
      terms_checked: termsBox()?.checked ?? false,
    };
  },
});

export const fillCoverLetter = defineTool({
  name: 'fill_cover_letter',
  displayName: 'Fill Cover Letter',
  description: `Type the cover letter (${COVER_MIN}-${COVER_MAX} chars) into the apply form and tick the "I understand" box. Does NOT click Submit Application.`,
  icon: 'pencil',
  input: z.object({
    text: z.string().min(COVER_MIN).max(COVER_MAX).describe(`Cover letter text, ${COVER_MIN}-${COVER_MAX} characters`),
  }),
  output: z.object({ pitch_length: z.number(), terms_checked: z.boolean() }),
  handle: async ({ text }) => {
    const lengthError = coverLetterError(text);
    if (lengthError) throw ToolError.validation(lengthError);
    const box = pitchBox();
    if (!box)
      throw ToolError.notFound(
        'Cover letter step not open. Click through Review Terms and Highlight Experience first.',
      );
    setNative(box, text);
    const terms = termsBox();
    if (terms && !terms.checked) terms.click();
    await new Promise(r => setTimeout(r, 300));
    return { pitch_length: box.value.length, terms_checked: termsBox()?.checked ?? false };
  },
});
