import { defineTool } from '@opentabs-dev/plugin-sdk';
import { z } from 'zod';
import { extractRequestsFromDOM, graphql, parseMutualCount, parseTimeApproxDays } from '../facebook-api.js';
import type { FriendRequestItem, TriageSuggestion } from '../types.js';

export const suggestTriage = defineTool({
  name: 'suggest_triage',
  displayName: 'Suggest Friend Requests Triage',
  description:
    'Analyzes pending Facebook friend requests and intelligently suggests who to ACCEPT, who to DELETE (decline), and who to REVIEW based on mutual connections, profile signals, and age of request.',
  icon: 'wand',
  input: z.object({
    min_mutual_to_accept: z
      .number()
      .int()
      .min(1)
      .max(100)
      .optional()
      .describe('Minimum mutual friends threshold to suggest ACCEPT (default: 15)'),
    min_age_years_to_delete_zero_mutual: z
      .number()
      .min(0.5)
      .max(15)
      .optional()
      .describe('Minimum request age in years to suggest DELETE when mutual friends count is 0 (default: 1.0)'),
    always_delete_zero_mutual: z
      .boolean()
      .optional()
      .describe('If true, immediately suggests DELETE for all requests with 0 mutual friends (default: false)'),
    limit: z
      .number()
      .int()
      .min(1)
      .max(500)
      .optional()
      .describe('Maximum number of requests to evaluate (default: 200)'),
  }),
  output: z.object({
    summary: z.object({
      total_evaluated: z.number().int().describe('Total requests analyzed'),
      accept_count: z.number().int().describe('Count of recommended ACCEPT requests'),
      delete_count: z.number().int().describe('Count of recommended DELETE requests'),
      review_count: z.number().int().describe('Count of requests needing human REVIEW'),
    }),
    suggestions: z.array(
      z.object({
        user_id: z.string().describe('Facebook User ID or profile handle'),
        name: z.string().describe('Full name'),
        profile_url: z.string().describe('Facebook profile URL'),
        action: z.enum(['ACCEPT', 'DELETE', 'REVIEW']).describe('Recommended action'),
        confidence: z.number().describe('Recommendation confidence score between 0.0 and 1.0'),
        reasons: z.array(z.string()).describe('List of rationale points explaining the recommendation'),
        mutual_friends: z.number().int().describe('Count of mutual friends'),
        request_time: z.string().optional().describe('Relative request time if available'),
      })
    ),
  }),
  handle: async params => {
    const minMutualToAccept = params.min_mutual_to_accept ?? 15;
    const minAgeDaysToDeleteZeroMutual = (params.min_age_years_to_delete_zero_mutual ?? 1.0) * 365;
    const alwaysDeleteZeroMutual = params.always_delete_zero_mutual ?? false;
    const limit = params.limit ?? 200;

    const items: FriendRequestItem[] = [];
    const seenIds = new Set<string>();

    // Collect requests from DOM first
    const domItems = extractRequestsFromDOM();
    for (const item of domItems) {
      if (!seenIds.has(item.id)) {
        seenIds.add(item.id);
        items.push(item);
      }
    }

    // Complement with GraphQL
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

    const evaluated = items.slice(0, limit);
    const suggestions: TriageSuggestion[] = [];

    let acceptCount = 0;
    let deleteCount = 0;
    let reviewCount = 0;

    for (const req of evaluated) {
      const reasons: string[] = [];
      let action: 'ACCEPT' | 'DELETE' | 'REVIEW' = 'REVIEW';
      let confidence = 0.5;

      const mutuals = req.mutual_friends;
      const ageDays = parseTimeApproxDays(req.request_time);
      const isFollowerOnly = req.mutual_friends_text.includes('Followed by') && mutuals === 0;

      // 1. High mutual friends -> ACCEPT
      if (mutuals >= minMutualToAccept) {
        action = 'ACCEPT';
        confidence = Math.min(0.95, 0.7 + (mutuals / 100) * 0.25);
        reasons.push(`Strong mutual network (${mutuals} mutual friends)`);

        if (mutuals >= 50) {
          reasons.push('High cluster overlap in professional or personal network');
        }
        if (ageDays > 0 && ageDays < 60) {
          reasons.push('Recent request (under 2 months old)');
        }
      }
      // 2. Zero mutual friends -> DELETE or REVIEW
      else if (mutuals === 0) {
        if (alwaysDeleteZeroMutual) {
          action = 'DELETE';
          confidence = 0.9;
          reasons.push('Zero mutual connections (always_delete_zero_mutual policy active)');
        } else if (ageDays >= minAgeDaysToDeleteZeroMutual) {
          action = 'DELETE';
          confidence = 0.88;
          reasons.push(`Zero mutual friends and request is stale (sent approx ${req.request_time ?? 'over a year'} ago)`);
        } else if (isFollowerOnly) {
          action = 'REVIEW';
          confidence = 0.6;
          reasons.push(`Public profile / creator (${req.mutual_friends_text}) with no direct mutual friends`);
        } else if (ageDays > 0 && ageDays < 30) {
          action = 'REVIEW';
          confidence = 0.55;
          reasons.push('Recent request but zero mutual connections; verify if met recently');
        } else {
          action = 'DELETE';
          confidence = 0.75;
          reasons.push('Zero mutual connections with unverified sender context');
        }
      }
      // 3. Low mutual friends (1 - (minMutualToAccept - 1))
      else {
        if (ageDays >= 365 * 3) {
          // Extremely stale low mutuals (e.g. 1 mutual from 7 years ago)
          action = 'DELETE';
          confidence = 0.8;
          reasons.push(`Stale request (${req.request_time} old) with only ${mutuals} mutual friend(s)`);
        } else if (mutuals >= 5 && ageDays < 90) {
          action = 'ACCEPT';
          confidence = 0.72;
          reasons.push(`Moderate mutual connections (${mutuals} mutual friends) and recent request`);
        } else {
          action = 'REVIEW';
          confidence = 0.65;
          reasons.push(`Borderline mutual overlap (${mutuals} mutual friends)`);
          if (req.request_time) {
            reasons.push(`Request age: ${req.request_time}`);
          }
        }
      }

      if (action === 'ACCEPT') acceptCount++;
      else if (action === 'DELETE') deleteCount++;
      else reviewCount++;

      suggestions.push({
        user_id: req.id,
        name: req.name,
        profile_url: req.profile_url,
        action,
        confidence: Number(confidence.toFixed(2)),
        reasons,
        mutual_friends: req.mutual_friends,
        request_time: req.request_time,
      });
    }

    return {
      summary: {
        total_evaluated: evaluated.length,
        accept_count: acceptCount,
        delete_count: deleteCount,
        review_count: reviewCount,
      },
      suggestions,
    };
  },
});
