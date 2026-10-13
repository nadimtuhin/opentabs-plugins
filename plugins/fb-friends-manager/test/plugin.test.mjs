import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';
import {
  assertAccepts,
  assertRejects,
  describePluginContract,
  findTool,
  loadPlugin,
} from '../../../test/plugin-contract.mjs';

const pluginDir = fileURLToPath(new URL('..', import.meta.url));
await describePluginContract(pluginDir);
const plugin = await loadPlugin(pluginDir);

describe('fb-friends-manager input validation', () => {
  it('confirm_friend_request and delete_friend_request need a user_id', () => {
    for (const name of ['confirm_friend_request', 'delete_friend_request']) {
      const tool = findTool(plugin, name);
      assertAccepts(tool, { user_id: '100012345' });
      assertRejects(tool, { user_id: '' });
      assertRejects(tool, {});
    }
  });

  it('list_friend_requests takes a whole limit from 1 to 500', () => {
    const tool = findTool(plugin, 'list_friend_requests');
    assertAccepts(tool, {});
    assertAccepts(tool, { limit: 500 });
    assertRejects(tool, { limit: 0 });
    assertRejects(tool, { limit: 501 });
    assertRejects(tool, { limit: 10.5 });
  });

  it('suggest_triage bounds its thresholds', () => {
    const tool = findTool(plugin, 'suggest_triage');
    assertAccepts(tool, {
      min_mutual_to_accept: 15,
      min_age_years_to_delete_zero_mutual: 0.5,
      always_delete_zero_mutual: true,
    });
    assertRejects(tool, { min_mutual_to_accept: 0 });
    assertRejects(tool, { min_age_years_to_delete_zero_mutual: 0.4 });
    assertRejects(tool, { min_age_years_to_delete_zero_mutual: 16 });
    assertRejects(tool, { always_delete_zero_mutual: 'yes' });
  });

  it('batch_triage_requests takes id lists and a 200-5000ms delay', () => {
    const tool = findTool(plugin, 'batch_triage_requests');
    assertAccepts(tool, { accept_user_ids: ['1', '2'], delete_user_ids: ['3'], delay_ms: 600 });
    assertRejects(tool, { delay_ms: 199 });
    assertRejects(tool, { delay_ms: 5001 });
    assertRejects(tool, { accept_user_ids: '1' });
  });
});
