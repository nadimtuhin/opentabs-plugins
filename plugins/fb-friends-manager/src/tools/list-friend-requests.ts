import { defineTool } from '@opentabs-dev/plugin-sdk';
import { z } from 'zod';
import { extractRequestsFromDOM, graphql, parseMutualCount } from '../facebook-api.js';
import type { FriendRequestItem } from '../types.js';

export const listFriendRequests = defineTool({
  name: 'list_friend_requests',
  displayName: 'List Friend Requests',
  description:
    'List pending incoming Facebook friend requests. Retrieves requests from Facebook GraphQL and DOM with names, IDs, mutual friend counts, and timestamps.',
  icon: 'users',
  input: z.object({
    limit: z
      .number()
      .int()
      .min(1)
      .max(500)
      .optional()
      .describe('Maximum number of friend requests to return (default 100)'),
  }),
  output: z.object({
    total_count: z.number().int().describe('Total number of friend requests found'),
    friend_requests: z.array(
      z.object({
        id: z.string().describe('User ID or profile vanity'),
        name: z.string().describe('Full name of the requester'),
        profile_url: z.string().describe('Facebook profile link'),
        profile_picture_url: z.string().optional().describe('Profile avatar URL'),
        mutual_friends: z.number().int().describe('Number of mutual friends'),
        mutual_friends_text: z.string().describe('Raw mutual friends or followers text'),
        request_time: z.string().optional().describe('Relative time request was received (e.g. 2w, 1y)'),
      })
    ),
  }),
  handle: async params => {
    const limit = params.limit ?? 100;
    const items: FriendRequestItem[] = [];
    const seenIds = new Set<string>();

    // 1. First attempt from DOM (gets all scrolled requests currently rendered)
    const domItems = extractRequestsFromDOM();
    for (const item of domItems) {
      if (!seenIds.has(item.id)) {
        seenIds.add(item.id);
        items.push(item);
      }
    }

    // 2. Supplement with GraphQL API if available
    try {
      const data = await graphql('FriendingCometRootContentQuery', { scale: 2 });
      const edges = data?.viewer?.friend_requests?.edges ?? [];
      for (const edge of edges) {
        const node = edge?.node;
        if (!node) continue;
        const id = String(node.id || '');
        if (!id || seenIds.has(id)) continue;

        seenIds.add(id);
        const name = node.name || 'Unknown';
        const mutualText = node.mutual_friends?.summary_text?.text || '';
        const mutualCount = node.mutual_friends?.count ?? parseMutualCount(mutualText);

        items.push({
          id,
          name,
          profile_url: node.url || `https://www.facebook.com/${id}`,
          profile_picture_url: node.profile_picture?.uri,
          mutual_friends: mutualCount,
          mutual_friends_text: mutualText,
        });
      }
    } catch {
      // If GraphQL fails or is not ready, rely on DOM items
    }

    const sliced = items.slice(0, limit);
    return {
      total_count: items.length,
      friend_requests: sliced,
    };
  },
});
