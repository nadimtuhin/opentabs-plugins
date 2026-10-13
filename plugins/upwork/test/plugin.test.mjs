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

const names = (count, prefix) => Array.from({ length: count }, (_, i) => `${prefix} ${i}`);

describe('upwork input validation', () => {
  it('set_profile_text needs title or overview and non-empty text', () => {
    const tool = findTool(plugin, 'set_profile_text');
    assertAccepts(tool, { section: 'title', text: 'Senior TypeScript Engineer' });
    assertRejects(tool, { section: 'rate', text: '$80' });
    assertRejects(tool, { section: 'overview', text: '' });
  });

  it('set_skills takes 1-20 non-empty skills', () => {
    const tool = findTool(plugin, 'set_skills');
    assertAccepts(tool, { skills: ['TypeScript', 'Go'] });
    assertAccepts(tool, { skills: names(20, 'skill') });
    assertRejects(tool, { skills: [] });
    assertRejects(tool, { skills: names(21, 'skill') });
    assertRejects(tool, { skills: [''] });
  });

  it('set_categories takes 1-10 non-empty categories', () => {
    const tool = findTool(plugin, 'set_categories');
    assertAccepts(tool, { categories: ['Web Development'] });
    assertAccepts(tool, { categories: names(10, 'category') });
    assertRejects(tool, { categories: [] });
    assertRejects(tool, { categories: names(11, 'category') });
  });
});
