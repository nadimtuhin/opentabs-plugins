import { defineTool, ToolError } from '@opentabs-dev/plugin-sdk';
import { z } from 'zod';
import { confirmFriendRequestAPI } from '../facebook-api.js';

export const confirmRequest = defineTool({
  name: 'confirm_friend_request',
  displayName: 'Confirm Friend Request',
  description: 'Accept an incoming Facebook friend request. Requires the sender numeric user ID or username.',
  icon: 'user-check',
  input: z.object({
    user_id: z.string().min(1).describe('Facebook User ID or username to accept'),
  }),
  output: z.object({
    success: z.boolean().describe('Whether request was confirmed'),
    user_id: z.string().describe('User ID confirmed'),
    message: z.string().describe('Confirmation status message'),
  }),
  handle: async params => {
    if (!params.user_id) {
      throw ToolError.validation('user_id is required.');
    }

    try {
      await confirmFriendRequestAPI(params.user_id);
      return {
        success: true,
        user_id: params.user_id,
        message: `Successfully accepted friend request from user ${params.user_id}.`,
      };
    } catch (err: any) {
      throw ToolError.internal(`Failed to confirm friend request for ${params.user_id}: ${err?.message ?? err}`);
    }
  },
});
