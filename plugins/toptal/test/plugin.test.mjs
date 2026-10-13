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

describe('toptal input validation', () => {
  it('fill_cover_letter needs text', () => {
    const tool = findTool(plugin, 'fill_cover_letter');
    assertAccepts(tool, { text: 'Hello' });
    assertRejects(tool, {});
  });

  it('fill_profile_fields takes string or boolean values', () => {
    const tool = findTool(plugin, 'fill_profile_fields');
    assertAccepts(tool, { fields: { headline: 'Engineer', smsConsent: false } });
    assertRejects(tool, { fields: { years: 5 } });
  });

  it('pick_option only works on industryIds and skills', () => {
    const tool = findTool(plugin, 'pick_option');
    assertAccepts(tool, { field: 'industryIds', label: 'Fintech' });
    assertRejects(tool, { field: 'country', label: 'Bangladesh' });
  });

  it('set_year takes a whole year from 1970 to 2100 on startDate or endDate', () => {
    const tool = findTool(plugin, 'set_year');
    assertAccepts(tool, { field: 'endDate', year: 2024 });
    assertRejects(tool, { field: 'endDate', year: 1969 });
    assertRejects(tool, { field: 'startDate', year: 2020.5 });
    assertRejects(tool, { field: 'graduationDate', year: 2020 });
  });

  it('add_skill needs a known proficiency and 1-20 years', () => {
    const tool = findTool(plugin, 'add_skill');
    assertAccepts(tool, { name: 'TypeScript', proficiency: 'EXPERT', years: 8 });
    assertRejects(tool, { name: 'TypeScript', proficiency: 'NOVICE', years: 8 });
    assertRejects(tool, { name: 'TypeScript', proficiency: 'STRONG', years: 0 });
    assertRejects(tool, { name: 'TypeScript', proficiency: 'STRONG', years: 21 });
    assertRejects(tool, { name: '', proficiency: 'STRONG', years: 3 });
  });

  it('remove_skill needs a non-empty name', () => {
    const tool = findTool(plugin, 'remove_skill');
    assertAccepts(tool, { name: 'jQuery' });
    assertRejects(tool, { name: '' });
  });
});
