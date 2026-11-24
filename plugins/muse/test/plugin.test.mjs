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

describe('muse input validation', () => {
  it('respond_approval needs index, a known decision and expect_text', () => {
    const tool = findTool(plugin, 'respond_approval');
    assertAccepts(tool, { index: 0, decision: 'always', expect_text: 'github.com' });
    assertRejects(tool, { index: -1, decision: 'allow', expect_text: 'github.com' });
    assertRejects(tool, { index: 0, decision: 'maybe', expect_text: 'github.com' });
    assertRejects(tool, { index: 0, decision: 'deny' });
  });
});
