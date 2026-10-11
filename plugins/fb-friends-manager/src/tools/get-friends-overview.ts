import { defineTool } from '@opentabs-dev/plugin-sdk';
import { z } from 'zod';
import {
  extractRequestsFromDOM,
  getCurrentUserData,
  graphql,
  parseMutualCount,
  parseTimeApproxDays,
} from '../facebook-api.js';
import type { FriendRequestItem } from '../types.js';

export const getFriendsOverview = defineTool({
  name: 'get_friends_overview',
  displayName: 'Get Friends Overview',
  description:
    'Returns statistical overview and health metrics of Facebook friend requests, including mutual friend tiers and request age distribution.',
  icon: 'pie-chart',
  input: z.object({}),
  output: z.object({
    viewer: z.object({
      user_id: z.string(),
      name: z.string(),
    }),
    total_requests: z.number().int().describe('Total pending requests count'),
    mutual_distribution: z.object({
      zero_mutuals: z.number().int(),
      low_1_to_10: z.number().int(),
      mid_11_to_50: z.number().int(),
      high_above_50: z.number().int(),
    }),
    age_distribution: z.object({
      recent_under_1m: z.number().int(),
      medium_1m_to_1y: z.number().int(),
      old_1y_to_5y: z.number().int(),
      ancient_over_5y: z.number().int(),
      unknown_age: z.number().int(),
    }),
    high_priority_accepts: z.array(
      z.object({
        name: z.string(),
        user_id: z.string(),
        mutual_friends: z.number().int(),
        profile_url: z.string(),
      })
    ),
  }),
  handle: async () => {
    let viewer = { userId: '', name: '', shortName: '' };
    try {
      viewer = getCurrentUserData();
    } catch {}

    const items: FriendRequestItem[] = [];
    const seenIds = new Set<string>();

    const domItems = extractRequestsFromDOM();
    for (const item of domItems) {
      if (!seenIds.has(item.id)) {
        seenIds.add(item.id);
        items.push(item);
      }
    }

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
    } catch {}

    const mutualDist = {
      zero_mutuals: 0,
      low_1_to_10: 0,
      mid_11_to_50: 0,
      high_above_50: 0,
    };

    const ageDist = {
      recent_under_1m: 0,
      medium_1m_to_1y: 0,
      old_1y_to_5y: 0,
      ancient_over_5y: 0,
      unknown_age: 0,
    };

    const highPriority: Array<{ name: string; user_id: string; mutual_friends: number; profile_url: string }> = [];

    for (const req of items) {
      const m = req.mutual_friends;
      if (m === 0) mutualDist.zero_mutuals++;
      else if (m <= 10) mutualDist.low_1_to_10++;
      else if (m <= 50) mutualDist.mid_11_to_50++;
      else {
        mutualDist.high_above_50++;
        if (highPriority.length < 10) {
          highPriority.push({
            name: req.name,
            user_id: req.id,
            mutual_friends: m,
            profile_url: req.profile_url,
          });
        }
      }

      const days = parseTimeApproxDays(req.request_time);
      if (!req.request_time || days === 0) {
        ageDist.unknown_age++;
      } else if (days <= 30) {
        ageDist.recent_under_1m++;
      } else if (days <= 365) {
        ageDist.medium_1m_to_1y++;
      } else if (days <= 365 * 5) {
        ageDist.old_1y_to_5y++;
      } else {
        ageDist.ancient_over_5y++;
      }
    }

    return {
      viewer: {
        user_id: viewer.userId,
        name: viewer.name,
      },
      total_requests: items.length,
      mutual_distribution: mutualDist,
      age_distribution: ageDist,
      high_priority_accepts: highPriority,
    };
  },
});
