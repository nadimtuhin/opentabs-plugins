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

describe('greenhouse input validation', () => {
  it('fill_application takes string or string-array answers', () => {
    const tool = findTool(plugin, 'fill_application');
    assertAccepts(tool, { answers: { first_name: 'Nadim', 'Which languages?': ['Go', 'TypeScript'] } });
    assertRejects(tool, { answers: { years: 5 } });
    assertRejects(tool, {});
  });

  it('attach_file needs a known field, a document filename and content', () => {
    const tool = findTool(plugin, 'attach_file');
    assertAccepts(tool, { field: 'resume', filename: 'cv.PDF', content_base64: 'JVBERi0=' });
    assertAccepts(tool, { field: 'cover_letter', filename: 'letter.docx', content_base64: 'UEsDBA==' });
    assertRejects(tool, { field: 'photo', filename: 'cv.pdf', content_base64: 'JVBERi0=' });
    assertRejects(tool, { field: 'resume', filename: 'cv.exe', content_base64: 'TVo=' });
    assertRejects(tool, { field: 'resume', filename: 'cv.pdf', content_base64: '' });
  });
});
