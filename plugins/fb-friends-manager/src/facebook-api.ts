import {
  ToolError,
  clearAuthCache,
  getAuthCache,
  setAuthCache,
  waitUntil,
} from '@opentabs-dev/plugin-sdk';
import type { FriendRequestItem } from './types.js';

interface FBAuth {
  userId: string;
  fbDtsg: string;
  lsd: string;
}

const fbRequire = (moduleName: string): any => {
  try {
    const req = (globalThis as any).require;
    if (typeof req !== 'function') return undefined;
    return req(moduleName);
  } catch {
    return undefined;
  }
};

export const getAuth = (): FBAuth | null => {
  const cached = getAuthCache('facebook') as FBAuth | undefined;
  if (cached?.userId && cached?.fbDtsg && cached?.lsd) {
    return cached;
  }

  const userId = fbRequire('CurrentUserInitialData')?.USER_ID ?? undefined;
  const fbDtsg = fbRequire('DTSGInitialData')?.token ?? undefined;
  const lsd = fbRequire('LSD')?.token ?? undefined;

  if (!userId || !fbDtsg || !lsd) {
    return null;
  }

  const auth: FBAuth = { userId, fbDtsg, lsd };
  setAuthCache('facebook', auth);
  return auth;
};

export const isAuthenticated = (): boolean => getAuth() !== null;

export const waitForAuth = async (): Promise<boolean> => {
  try {
    await waitUntil(() => isAuthenticated(), {
      interval: 500,
      timeout: 5000,
    });
    return true;
  } catch {
    return false;
  }
};

export const requireAuth = (): FBAuth => {
  const auth = getAuth();
  if (!auth) {
    throw ToolError.auth('Not authenticated — please log in to Facebook in your browser tab.');
  }
  return auth;
};

export const getCurrentUserData = (): { userId: string; name: string; shortName: string } => {
  requireAuth();
  const mod = fbRequire('CurrentUserInitialData');
  return {
    userId: mod?.USER_ID ?? '',
    name: mod?.NAME ?? '',
    shortName: mod?.SHORT_NAME ?? '',
  };
};

const DEFAULT_DOC_IDS: Record<string, string> = {
  FriendingCometFriendRequestConfirmMutation: '27351021931180810',
  FriendingCometFriendRequestDeleteMutation: '27694540350183683',
  FriendingCometFriendRequestsRootQuery: '26619914564335965',
  FriendingCometRootContentQuery: '35433309119618037',
};

const getDocIdCache = (): Record<string, string> => {
  const g = globalThis as any;
  if (!g.__fbDocIdCache || typeof g.__fbDocIdCache !== 'object') {
    g.__fbDocIdCache = { ...DEFAULT_DOC_IDS };
  }
  return g.__fbDocIdCache;
};

export const resolveDocId = (operationName: string): string => {
  const freshId = fbRequire(`${operationName}_facebookRelayOperation`);
  if (freshId !== undefined) {
    const cache = getDocIdCache();
    cache[operationName] = String(freshId);
    return String(freshId);
  }

  const cached = getDocIdCache()[operationName];
  if (cached) return cached;

  throw ToolError.internal(
    `Could not resolve doc_id for ${operationName}. Ensure you are on a Facebook page with friends navigation active.`
  );
};

export const graphql = async <T = any>(operationName: string, variables: Record<string, any> = {}): Promise<T> => {
  const auth = requireAuth();
  const docId = resolveDocId(operationName);

  const body = new URLSearchParams({
    av: auth.userId,
    __user: auth.userId,
    __a: '1',
    __comet_req: '15',
    fb_dtsg: auth.fbDtsg,
    lsd: auth.lsd,
    fb_api_caller_class: 'RelayModern',
    fb_api_req_friendly_name: operationName,
    variables: JSON.stringify(variables),
    server_timestamps: 'true',
    doc_id: docId,
  });

  const resp = await fetch('/api/graphql/', {
    method: 'POST',
    credentials: 'include',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'X-FB-LSD': auth.lsd,
      'X-FB-Friendly-Name': operationName,
    },
    body: body.toString(),
    signal: AbortSignal.timeout(30_000),
  });

  if (!resp.ok) {
    clearAuthCache('facebook');
    if (resp.status === 401 || resp.status === 403) {
      throw ToolError.auth('Facebook session expired — please log in again.');
    }
    if (resp.status === 429) {
      throw ToolError.rateLimited('Rate limited by Facebook API. Please wait a moment.');
    }
    throw ToolError.internal(`Facebook API returned HTTP ${resp.status}.`);
  }

  const text = await resp.text();
  const cleaned = text.replace(/^for \(;;\);/, '');
  const lines = cleaned.split('\n').filter(Boolean);

  const parsed = lines.map(line => {
    try {
      return JSON.parse(line);
    } catch {
      return null;
    }
  });

  const first = parsed.find(p => p !== null);
  if (!first) {
    throw ToolError.internal('Empty response from Facebook GraphQL API.');
  }

  const errors = first.errors;
  const hasData = first.data !== undefined && first.data !== null;
  if (errors?.length && !hasData) {
    const msg = errors[0]?.message ?? 'Unknown GraphQL error';
    const code = errors[0]?.code;
    if (msg.includes('not authenticated') || msg.includes('session') || code === 190) {
      clearAuthCache('facebook');
      throw ToolError.auth(msg);
    }
    throw ToolError.internal(`Facebook GraphQL error: ${msg}`);
  }

  return (first.data ?? first) as T;
};

export const parseMutualCount = (text: string): number => {
  if (!text) return 0;
  const match = text.match(/(\d+)\s+mutual/i);
  if (match && match[1]) {
    return parseInt(match[1], 10);
  }
  return 0;
};

export const parseTimeApproxDays = (timeStr?: string): number => {
  if (!timeStr) return 0;
  const m = timeStr.trim().match(/^(\d+)([dwhmy])$/);
  if (!m || !m[1] || !m[2]) return 0;
  const val = parseInt(m[1], 10);
  const unit = m[2];
  switch (unit) {
    case 'd': return val;
    case 'w': return val * 7;
    case 'h': return Math.ceil(val / 24);
    case 'm': return val * 30;
    case 'y': return val * 365;
    default: return 0;
  }
};

/**
 * Extract all rendered friend request items from the active Facebook page DOM.
 */
export const extractRequestsFromDOM = (): FriendRequestItem[] => {
  if (typeof document === 'undefined') return [];

  // Find the container with friend request cards
  const confirmButtons = Array.from(document.querySelectorAll('div[role="button"], button')).filter(
    b => (b as HTMLElement).innerText?.trim() === 'Confirm'
  );

  const results: FriendRequestItem[] = [];
  const seenIds = new Set<string>();

  for (const btn of confirmButtons) {
    let card: HTMLElement = btn as HTMLElement;
    for (let i = 0; i < 7; i++) {
      if (card.parentElement && card.parentElement !== document.body) {
        card = card.parentElement;
      }
    }

    const links = Array.from(card.querySelectorAll<HTMLAnchorElement>('a[href]'));
    let profileLink = '';
    let name = '';

    for (const a of links) {
      const href = a.getAttribute('href') || '';
      const text = a.innerText?.trim() || '';
      if (href && !href.includes('/friends') && text && !text.includes('\n')) {
        profileLink = (href.split('?')[0]) ?? '';
        name = text;
        break;
      }
    }

    if (!profileLink && links.length > 0 && links[0]) {
      const firstHref = links[0].getAttribute('href') || '';
      profileLink = (firstHref.split('?')[0]) ?? '';
    }

    const lines = (card.innerText || '').split('\n').map(l => l.trim()).filter(Boolean);
    const mutualLine = lines.find(l => l.includes('mutual') || l.includes('Followed by')) || '';
    const timeLine = lines.find(l => /^[0-9]+[wdhmy]$/.test(l)) || '';

    let userId = '';
    const idMatch = profileLink.match(/id=(\d+)/) || profileLink.match(/facebook\.com\/([a-zA-Z0-9._]+)/);
    if (idMatch && idMatch[1]) {
      userId = idMatch[1];
    }

    const finalId = userId || profileLink;
    if (finalId && !seenIds.has(finalId)) {
      seenIds.add(finalId);
      results.push({
        id: finalId,
        name: name || lines[0] || 'Unknown',
        profile_url: profileLink || `https://www.facebook.com/${finalId}`,
        mutual_friends: parseMutualCount(mutualLine),
        mutual_friends_text: mutualLine,
        request_time: timeLine,
      });
    }
  }

  return results;
};

export const confirmFriendRequestAPI = async (userId: string): Promise<boolean> => {
  const currentUser = getCurrentUserData();
  await graphql('FriendingCometFriendRequestConfirmMutation', {
    input: {
      friend_requester_id: userId,
      source: 'friends_tab',
      actor_id: currentUser.userId,
      client_mutation_id: String(Date.now()),
    },
  });
  return true;
};

export const deleteFriendRequestAPI = async (userId: string): Promise<boolean> => {
  const currentUser = getCurrentUserData();
  await graphql('FriendingCometFriendRequestDeleteMutation', {
    input: {
      friend_requester_id: userId,
      source: 'friends_tab',
      actor_id: currentUser.userId,
      client_mutation_id: String(Date.now()),
    },
  });
  return true;
};
