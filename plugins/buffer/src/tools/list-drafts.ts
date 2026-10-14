import { defineTool, ToolError } from '@opentabs-dev/plugin-sdk';
import { z } from 'zod';
import { counts, onDraftsTab, readDrafts } from '../buffer-dom.js';

export const draftSchema = z.object({
  index: z.number().describe('Position in the Drafts list, usable in schedule_drafts'),
  preview: z.string().describe('First ~60 characters of the post'),
  channel: z.string(),
  schedulable: z
    .boolean()
    .describe('true when the draft already has a time ("Schedule Post"); false means "Add to Queue"'),
});

export const listDrafts = defineTool({
  name: 'list_drafts',
  displayName: 'List Drafts',
  description:
    'Read the Buffer Drafts tab: each draft with its preview text, channel and whether it already has a time and can be scheduled. Open the Drafts tab first (it needs a trusted click on #drafts-tab).',
  icon: 'list',
  input: z.object({}),
  output: z.object({ queue: z.number(), drafts_total: z.number(), drafts: z.array(draftSchema) }),
  handle: async () => {
    if (!onDraftsTab())
      throw ToolError.notFound('Drafts tab is not open. Click #drafts-tab with browser_click_element first.');
    const c = counts();
    return {
      queue: c.queue,
      drafts_total: c.drafts,
      drafts: readDrafts().map(({ preview, channel, schedulable }, index) => ({
        index,
        preview,
        channel,
        schedulable,
      })),
    };
  },
});
