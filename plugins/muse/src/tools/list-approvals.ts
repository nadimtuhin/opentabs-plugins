import { defineTool } from '@opentabs-dev/plugin-sdk';
import { z } from 'zod';
import { cards, describeCard } from '../muse-dom.js';

export const listApprovals = defineTool({
  name: 'list_approvals',
  displayName: 'List Approvals',
  description:
    'List the approval cards the muse.ai assistant is waiting on in the open chat or Approvals panel: the site or action it asks for and the buttons offered.',
  icon: 'list',
  input: z.object({}),
  output: z.object({
    approvals: z.array(
      z.object({
        index: z.number().describe('Position on the page, usable in respond_approval'),
        surface: z.string().describe('Where the card shows: chat or panel'),
        text: z.string().describe('Card text, first 500 characters'),
        buttons: z.array(z.string()),
      }),
    ),
  }),
  handle: async () => ({ approvals: cards().map(describeCard) }),
});
