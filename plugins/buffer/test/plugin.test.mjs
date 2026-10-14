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

describe('buffer input validation', () => {
  it('schedule_drafts takes 1 to 10 match strings of 3+ chars', () => {
    const tool = findTool(plugin, 'schedule_drafts');
    assertAccepts(tool, { match: ['I had an AI agent'] });
    assertRejects(tool, { match: [] });
    assertRejects(tool, { match: ['ab'] });
    assertRejects(tool, { match: Array(11).fill('Agent said') });
    assertRejects(tool, {});
  });
});
