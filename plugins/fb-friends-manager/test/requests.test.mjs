import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { parseHTML } from 'linkedom';
import { fileURLToPath } from 'node:url';
import { findTool, loadPlugin } from '../../../test/plugin-contract.mjs';
import { extractRequestsFromDOM, parseMutualCount, parseTimeApproxDays } from '../dist/facebook-api.js';

const pluginDir = fileURLToPath(new URL('..', import.meta.url));
const plugin = await loadPlugin(pluginDir);
const suggest = findTool(plugin, 'suggest_triage');
const overview = findTool(plugin, 'get_friends_overview');

function installPage(html) {
  const { document } = parseHTML(`<!doctype html><html><body>${html}</body></html>`);
  globalThis.document = document;
  if (globalThis.__openTabs?.tokenCache) globalThis.__openTabs.tokenCache.facebook = undefined;
  delete globalThis.require;
  globalThis.fetch = async () => {
    throw new Error('unexpected Facebook fetch');
  };
  return document;
}

function card({ href, name, mutual, time, button = 'Confirm' }) {
  return `<div class="card">
    <a href="https://www.facebook.com/friends/suggestions">See all</a>
    <a href="${href}">${name}</a>
    ${mutual ? `<div>${mutual}</div>` : ''}
    ${time ? `<div>${time}</div>` : ''}
    <div role="button">${button}</div>
  </div>`;
}

const PAGE = [
  card({ href: 'https://www.facebook.com/ada.lovelace', name: 'Ada Lovelace', mutual: '20 mutual friends', time: '2w' }),
  card({ href: 'https://www.facebook.com/bob', name: 'Bob', mutual: '60 mutual friends', time: '3y' }),
  card({
    href: 'https://www.facebook.com/profile.php?id=1001&sk=about',
    name: 'Cara',
    mutual: '0 mutual friends',
    time: '2y',
  }),
  card({
    href: 'https://www.facebook.com/profile.php?id=1002',
    name: 'Cara Twin',
    mutual: '1,234 mutual friends',
    time: '1d',
  }),
  card({ href: 'https://www.facebook.com/dan', name: 'Dan', mutual: 'Followed by 4 people', time: '3d' }),
  card({ href: 'https://www.facebook.com/eve', name: 'Eve', mutual: '0 mutual friends', time: '5d' }),
  card({ href: 'https://www.facebook.com/finn', name: 'Finn', mutual: '0 mutual friends' }),
  card({ href: 'https://www.facebook.com/gina', name: 'Gina', mutual: '8 mutual friends', time: '2w' }),
  card({ href: 'https://www.facebook.com/hank', name: 'Hank', mutual: '3 mutual friends', time: '4y' }),
  card({ href: 'https://www.facebook.com/iris', name: 'Iris', mutual: '4 mutual friends', time: '6m' }),
  card({ href: 'https://www.facebook.com/ada.lovelace', name: 'Ada Duplicate', mutual: '20 mutual friends', time: '2w' }),
  card({ href: 'https://www.facebook.com/skip', name: 'Skip', mutual: '9 mutual friends', time: '1d', button: 'Delete' }),
].join('');

const byId = suggestions => Object.fromEntries(suggestions.map(s => [s.user_id, s]));

describe('friend request parsers', () => {
  it('counts mutual friends, including thousands separators', () => {
    assert.equal(parseMutualCount(''), 0);
    assert.equal(parseMutualCount('Followed by 4 people'), 0);
    assert.equal(parseMutualCount('1 mutual friend'), 1);
    assert.equal(parseMutualCount('12 MUTUAL FRIENDS'), 12);
    assert.equal(parseMutualCount('1,234 mutual friends'), 1234);
  });

  it('turns compact Facebook ages into approximate days', () => {
    assert.equal(parseTimeApproxDays(undefined), 0);
    assert.equal(parseTimeApproxDays('yesterday'), 0);
    assert.equal(parseTimeApproxDays('2D'), 0);
    assert.equal(parseTimeApproxDays(' 2w '), 14);
    assert.equal(parseTimeApproxDays('3d'), 3);
    assert.equal(parseTimeApproxDays('1h'), 1);
    assert.equal(parseTimeApproxDays('25h'), 2);
    assert.equal(parseTimeApproxDays('2m'), 60);
    assert.equal(parseTimeApproxDays('3y'), 1095);
  });

  it('returns nothing when the page is not available', () => {
    delete globalThis.document;
    assert.deepEqual(extractRequestsFromDOM(), []);
  });

  it('reads ids from usernames and profile.php?id=, and skips non-confirm cards', () => {
    installPage(PAGE);
    const requests = extractRequestsFromDOM();
    const ids = requests.map(r => r.id);
    assert.deepEqual(ids, ['ada.lovelace', 'bob', '1001', '1002', 'dan', 'eve', 'finn', 'gina', 'hank', 'iris']);
    const cara = requests.find(r => r.id === '1001');
    assert.equal(cara.name, 'Cara');
    assert.equal(cara.profile_url, 'https://www.facebook.com/profile.php');
    assert.equal(cara.mutual_friends, 0);
    assert.equal(cara.request_time, '2y');
    assert.equal(requests.find(r => r.id === '1002').mutual_friends, 1234);
    assert.equal(requests.find(r => r.id === 'dan').mutual_friends_text, 'Followed by 4 people');
    assert.equal(requests.find(r => r.id === 'finn').request_time, '');
  });
});

describe('suggest_triage', () => {
  it('accepts strong or recent networks and deletes stale or empty ones', async () => {
    installPage(PAGE);
    const { summary, suggestions } = await suggest.handle({});
    const actions = byId(suggestions);
    assert.equal(summary.total_evaluated, 10);
    assert.deepEqual(
      { accept: summary.accept_count, delete: summary.delete_count, review: summary.review_count },
      { accept: 4, delete: 3, review: 3 },
    );

    assert.equal(actions['ada.lovelace'].action, 'ACCEPT');
    assert.equal(actions['ada.lovelace'].confidence, 0.75);
    assert.ok(actions['ada.lovelace'].reasons.some(r => r.includes('Strong mutual network (20')));
    assert.ok(actions['ada.lovelace'].reasons.some(r => r.includes('Recent request')));

    assert.equal(actions.bob.action, 'ACCEPT');
    assert.equal(actions.bob.confidence, 0.85);
    assert.ok(actions.bob.reasons.some(r => r.includes('High cluster overlap')));

    assert.equal(actions['1002'].action, 'ACCEPT');
    assert.equal(actions['1001'].action, 'DELETE');
    assert.equal(actions['1001'].confidence, 0.88);
    assert.ok(actions['1001'].reasons[0].includes('stale'));

    assert.equal(actions.dan.action, 'REVIEW');
    assert.equal(actions.dan.confidence, 0.6);
    assert.match(actions.dan.reasons[0], /creator/);

    assert.equal(actions.eve.action, 'REVIEW');
    assert.equal(actions.eve.confidence, 0.55);

    assert.equal(actions.finn.action, 'DELETE');
    assert.equal(actions.finn.confidence, 0.75);

    assert.equal(actions.gina.action, 'ACCEPT');
    assert.equal(actions.gina.confidence, 0.72);

    assert.equal(actions.hank.action, 'DELETE');
    assert.equal(actions.hank.confidence, 0.8);

    assert.equal(actions.iris.action, 'REVIEW');
    assert.equal(actions.iris.confidence, 0.65);
    assert.ok(actions.iris.reasons.some(r => r.includes('6m')));
  });

  it('does not treat a missing timestamp as a recent request', async () => {
    installPage(card({ href: 'https://www.facebook.com/no-time', name: 'No Time', mutual: '7 mutual friends' }));
    const { suggestions } = await suggest.handle({});
    assert.equal(suggestions[0].action, 'REVIEW');
    assert.equal(suggestions[0].confidence, 0.65);
  });

  it('honors accept threshold, zero-mutual policy, and limit', async () => {
    installPage(PAGE);
    const raised = await suggest.handle({ min_mutual_to_accept: 25 });
    assert.equal(byId(raised.suggestions)['ada.lovelace'].action, 'ACCEPT');
    assert.equal(byId(raised.suggestions)['ada.lovelace'].confidence, 0.72);

    const forced = await suggest.handle({ always_delete_zero_mutual: true });
    for (const id of ['1001', 'dan', 'eve', 'finn']) {
      assert.equal(byId(forced.suggestions)[id].action, 'DELETE', id);
      assert.equal(byId(forced.suggestions)[id].confidence, 0.9);
    }

    const limited = await suggest.handle({ limit: 2 });
    assert.equal(limited.summary.total_evaluated, 2);
    assert.deepEqual(
      limited.suggestions.map(s => s.user_id),
      ['ada.lovelace', 'bob'],
    );
  });

  it('keeps the DOM results when GraphQL fails, and merges unseen API rows', async () => {
    installPage(card({ href: 'https://www.facebook.com/ada.lovelace', name: 'Ada Lovelace', mutual: '20 mutual friends', time: '2w' }));
    globalThis.require = name => {
      if (name === 'CurrentUserInitialData') return { USER_ID: '42', NAME: 'Nadim', SHORT_NAME: 'N' };
      if (name === 'DTSGInitialData') return { token: 'dtsg' };
      if (name === 'LSD') return { token: 'lsd' };
      return undefined;
    };
    globalThis.fetch = async () => ({ ok: false, status: 500, text: async () => '' });
    const failed = await suggest.handle({});
    assert.deepEqual(
      failed.suggestions.map(s => s.user_id),
      ['ada.lovelace'],
    );

    globalThis.__openTabs.tokenCache.facebook = undefined;
    globalThis.fetch = async () => ({
      ok: true,
      status: 200,
      text: async () =>
        `for (;;);\n${JSON.stringify({
          data: {
            viewer: {
              friend_requests: {
                edges: [
                  { node: null },
                  { node: { id: '', name: 'blank' } },
                  {
                    node: {
                      id: 'ada.lovelace',
                      name: 'Ada From API',
                      url: 'https://www.facebook.com/ada.lovelace',
                      mutual_friends: { count: 99, summary_text: { text: '99 mutual friends' } },
                    },
                  },
                  {
                    node: {
                      id: '555',
                      name: 'New Person',
                      mutual_friends: { count: 3, summary_text: { text: '99 mutual friends' } },
                    },
                  },
                  {
                    node: {
                      id: '556',
                      name: 'From Text',
                      mutual_friends: { summary_text: { text: '7 mutual friends' } },
                    },
                  },
                ],
              },
            },
          },
        })}`,
    });
    const merged = await suggest.handle({});
    const actions = byId(merged.suggestions);
    assert.deepEqual(
      merged.suggestions.map(s => s.user_id),
      ['ada.lovelace', '555', '556'],
    );
    assert.equal(actions['ada.lovelace'].name, 'Ada Lovelace');
    assert.equal(actions['ada.lovelace'].mutual_friends, 20);
    assert.equal(actions['555'].mutual_friends, 3);
    assert.equal(actions['555'].action, 'REVIEW');
    assert.equal(actions['556'].mutual_friends, 7);
    assert.equal(actions['556'].action, 'REVIEW');
  });
});

describe('get_friends_overview', () => {
  it('buckets mutuals and ages, and lists only the highest-mutual requests', async () => {
    installPage(PAGE);
    const result = await overview.handle({});
    assert.deepEqual(result.viewer, { user_id: '', name: '' });
    assert.equal(result.total_requests, 10);
    assert.deepEqual(result.mutual_distribution, {
      zero_mutuals: 4,
      low_1_to_10: 3,
      mid_11_to_50: 1,
      high_above_50: 2,
    });
    assert.deepEqual(result.age_distribution, {
      recent_under_1m: 5,
      medium_1m_to_1y: 1,
      old_1y_to_5y: 3,
      ancient_over_5y: 0,
      unknown_age: 1,
    });
    assert.deepEqual(
      result.high_priority_accepts.map(r => r.user_id),
      ['bob', '1002'],
    );
  });
});
