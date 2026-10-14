import { defineTool, ToolError } from '@opentabs-dev/plugin-sdk';
import { z } from 'zod';
import { counts, onDraftsTab, readDrafts, scheduleOne, sleep } from '../buffer-dom.js';

export const scheduleDrafts = defineTool({
  name: 'schedule_drafts',
  displayName: 'Schedule Drafts',
  description:
    'Schedule Buffer drafts that already have a time, by matching their preview text. Only presses "Schedule Post" and its confirm; never "Add to Queue", "Publish now" or "Share next". Stops at the first failure. Max 10 per call (Buffer free plan limit).',
  icon: 'calendar-check',
  input: z.object({
    match: z
      .array(z.string().min(3))
      .min(1)
      .max(10)
      .describe('Start of each draft text to schedule, as shown by list_drafts preview'),
  }),
  output: z.object({
    results: z.array(z.object({ match: z.string(), ok: z.boolean(), when: z.string(), reason: z.string().optional() })),
    queue: z.number(),
    drafts_left: z.number(),
  }),
  handle: async ({ match }) => {
    if (!onDraftsTab())
      throw ToolError.notFound('Drafts tab is not open. Click #drafts-tab with browser_click_element first.');
    const results: { match: string; ok: boolean; when: string; reason?: string }[] = [];
    for (const m of match) {
      // Re-read every time: the list re-renders after each schedule.
      const hits = readDrafts().filter(d => d.preview.startsWith(m) || m.startsWith(d.preview));
      if (hits.length !== 1) {
        results.push({
          match: m,
          ok: false,
          when: '',
          reason: hits.length ? `${hits.length} drafts match, be more specific` : 'no draft matches',
        });
        break;
      }
      const card = hits[0];
      if (!card) break;
      if (!card.schedulable) {
        results.push({ match: m, ok: false, when: '', reason: 'draft has no time set (Add to Queue only)' });
        break;
      }
      const r = await scheduleOne(card);
      results.push({ match: m, ...r });
      if (!r.ok) break;
      await sleep(400);
    }
    const c = counts();
    return { results, queue: c.queue, drafts_left: c.drafts };
  },
});
