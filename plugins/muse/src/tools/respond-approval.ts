import { defineTool, ToolError } from '@opentabs-dev/plugin-sdk';
import { z } from 'zod';
import { cards, findButton, labelOf } from '../muse-dom.js';

export const respondApproval = defineTool({
  name: 'respond_approval',
  displayName: 'Respond to Approval',
  description:
    'Answer one muse.ai approval card. "allow" approves once, "always" picks Always allow when offered (else allow once), "deny" rejects. expect_text (from list_approvals) is checked first so the wrong card is never clicked.',
  icon: 'check',
  input: z.object({
    index: z.number().int().min(0).describe('Card index from list_approvals'),
    decision: z.enum(['allow', 'always', 'deny']),
    expect_text: z.string().min(3).describe('A piece of the card text, checked before clicking'),
  }),
  output: z.object({ clicked: z.string() }),
  handle: async ({ index, decision, expect_text }) => {
    const card = cards()[index];
    if (!card) throw ToolError.notFound(`No approval card at index ${index}. Run list_approvals again.`);
    if (!card.innerText.includes(expect_text))
      throw ToolError.notFound('Card text does not contain expect_text; the list changed. Run list_approvals again.');
    const button = findButton(card, decision);
    if (!button) throw ToolError.notFound(`No ${decision} button on this card.`);
    button.click();
    return { clicked: labelOf(button) };
  },
});
