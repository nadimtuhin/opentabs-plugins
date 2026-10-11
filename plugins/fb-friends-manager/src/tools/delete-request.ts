import { defineTool, ToolError } from '@opentabs-dev/plugin-sdk';
import { z } from 'zod';
import { deleteFriendRequestAPI } from '../facebook-api.js';

export const deleteRequest = defineTool({
  name: 'delete_friend_request',
  displayName: 'Delete Friend Request',
  description: 'Decline or delete an incoming Facebook friend request. Requires the sender numeric user ID or username.',
  icon: 'user-x',
  input: z.object({
    user_id: z.string().min(1).describe('Facebook User ID or username to decline/delete'),
  }),
  output: z.object({
    success: z.boolean().describe('Whether request was deleted/declined'),
    user_id: z.string().describe('User ID declined'),
    message: z.string().describe('Deletion status message'),
  }),
  handle: async params => {
    if (!params.user_id) {
      throw ToolError.validation('user_id is required.');
    }

    try {
      await deleteFriendRequestAPI(params.user_id);
      return {
        success: true,
        user_id: params.user_id,
        message: `Successfully declined/deleted friend request from user ${params.user_id}.`,
      };
    } catch (err: any) {
      throw ToolError.internal(`Failed to delete friend request for ${params.user_id}: ${err?.message ?? err}`);
    }
  },
});
