import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';
import {
  assertAccepts,
  describePluginContract,
  findTool,
  loadPlugin,
} from '../../../test/plugin-contract.mjs';

const pluginDir = fileURLToPath(new URL('..', import.meta.url));
await describePluginContract(pluginDir);
const plugin = await loadPlugin(pluginDir);

describe('company-scout input validation', () => {
  it('extract_company_dossier accepts empty object', () => {
    const tool = findTool(plugin, 'extract_company_dossier');
    assertAccepts(tool, {});
  });
});
