import { defineTool, sleep } from '@opentabs-dev/plugin-sdk';
import { z } from 'zod';
import { confirmFriendRequestAPI, deleteFriendRequestAPI } from '../facebook-api.js';

export const batchTriage = defineTool({
  name: 'batch_triage_requests',
  displayName: 'Batch Triage Requests',
  description:
    'Accept or delete multiple friend requests in batch with safety delays to avoid Facebook rate limits.',
  icon: 'list-checks',
  input: z.object({
    accept_user_ids: z
      .array(z.string())
      .optional()
      .describe('List of user IDs to accept/confirm'),
    delete_user_ids: z
      .array(z.string())
      .optional()
      .describe('List of user IDs to delete/decline'),
    delay_ms: z
      .number()
      .int()
      .min(200)
      .max(5000)
      .optional()
      .describe('Delay in milliseconds between successive actions (default: 600ms)'),
  }),
  output: z.object({
    accepted: z.array(z.string()).describe('User IDs successfully accepted'),
    deleted: z.array(z.string()).describe('User IDs successfully deleted/declined'),
    failed: z.array(
      z.object({
        user_id: z.string(),
        action: z.enum(['ACCEPT', 'DELETE']),
        error: z.string(),
      })
    ).describe('Failed actions with errors'),
    total_processed: z.number().int().describe('Total actions executed'),
  }),
  handle: async params => {
    const toAccept = params.accept_user_ids ?? [];
    const toDelete = params.delete_user_ids ?? [];
    const delay = params.delay_ms ?? 600;

    const accepted: string[] = [];
    const deleted: string[] = [];
    const failed: Array<{ user_id: string; action: 'ACCEPT' | 'DELETE'; error: string }> = [];

    // Process accepts
    for (const userId of toAccept) {
      try {
        await confirmFriendRequestAPI(userId);
        accepted.push(userId);
      } catch (err: any) {
        failed.push({
          user_id: userId,
          action: 'ACCEPT',
          error: err?.message ?? String(err),
        });
      }
      if (delay > 0) await sleep(delay);
    }

    // Process deletes
    for (const userId of toDelete) {
      try {
        await deleteFriendRequestAPI(userId);
        deleted.push(userId);
      } catch (err: any) {
        failed.push({
          user_id: userId,
          action: 'DELETE',
          error: err?.message ?? String(err),
        });
      }
      if (delay > 0) await sleep(delay);
    }

    return {
      accepted,
      deleted,
      failed,
      total_processed: accepted.length + deleted.length + failed.length,
    };
  },
});
