// Shared smoke checks every plugin runs against its built `dist/index.js`.
// Each plugin's test file runs in its own process (node --test), so the jitless
// check sees only that plugin's bootstrap.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it } from 'node:test';
import { fileURLToPath, pathToFileURL } from 'node:url';

const repoRoot = fileURLToPath(new URL('..', import.meta.url));

const readText = path => readFileSync(path, 'utf8');

// The root README has one section per plugin, headed "### N. Title (`name`)" and closed by "---".
function rootReadmeSection(pluginName) {
  const readme = readText(join(repoRoot, 'README.md'));
  const start = readme.indexOf(`(\`${pluginName}\`)`);
  assert.notEqual(start, -1, `root README has no section for \`${pluginName}\``);
  const end = readme.indexOf('\n---', start);
  return readme.slice(start, end === -1 ? undefined : end);
}

// Finds `opentabs tool call <plugin>__<tool> '<json>'` lines so README examples stay valid.
function readmeExamples(readme, pluginName) {
  const pattern = new RegExp(`opentabs tool call ${pluginName}__(\\w+) '([^']*)'`, 'g');
  return [...readme.matchAll(pattern)].map(([, tool, json]) => ({ tool, json }));
}

export async function loadPlugin(pluginDir) {
  const module = await import(pathToFileURL(join(pluginDir, 'dist', 'index.js')).href);
  return module.default;
}

export function findTool(plugin, name) {
  const tool = plugin.tools.find(t => t.name === name);
  assert.ok(tool, `tool ${name} not registered`);
  return tool;
}

export function assertAccepts(tool, input) {
  const result = tool.input.safeParse(input);
  assert.ok(result.success, `${tool.name} rejected ${JSON.stringify(input)}: ${result.error?.message}`);
}

export function assertRejects(tool, input) {
  assert.equal(tool.input.safeParse(input).success, false, `${tool.name} accepted ${JSON.stringify(input)}`);
}

export async function describePluginContract(pluginDir) {
  const pkg = JSON.parse(readText(join(pluginDir, 'package.json')));
  const readme = readText(join(pluginDir, 'README.md'));
  const plugin = await loadPlugin(pluginDir);

  describe('plugin contract', () => {
    const toolNames = plugin.tools.map(t => t.name);

    it('turns on Zod jitless mode when the adapter loads', () => {
      assert.equal(globalThis.__zod_globalConfig?.jitless, true);
    });

    it('matches the opentabs metadata in package.json', () => {
      assert.equal(`opentabs-plugin-${plugin.name}`, pkg.name);
      assert.deepEqual([...plugin.urlPatterns], pkg.opentabs.urlPatterns);
      assert.equal(plugin.displayName, pkg.opentabs.displayName);
    });

    it('registers tools with unique snake_case names and a description', () => {
      assert.ok(toolNames.length > 0);
      assert.equal(new Set(toolNames).size, toolNames.length, 'duplicate tool names');
      for (const tool of plugin.tools) {
        assert.match(tool.name, /^[a-z][a-z0-9_]*$/);
        assert.ok(tool.description.trim(), `${tool.name} has no description`);
        assert.equal(typeof tool.input.safeParse, 'function', `${tool.name} input is not a Zod schema`);
        assert.equal(typeof tool.handle, 'function');
      }
    });

    it('documents every tool and the tool count in the plugin README', () => {
      assert.match(readme, new RegExp(`## Tools \\(${toolNames.length}\\)`));
      for (const name of toolNames) assert.ok(readme.includes(`\`${name}\``), `README misses ${name}`);
    });

    it('documents every tool and the tool count in the root README', () => {
      const section = rootReadmeSection(plugin.name);
      assert.match(section, new RegExp(`\\*\\*Tools:\\*\\* ${toolNames.length}\\b`));
      for (const name of toolNames) assert.ok(section.includes(`\`${name}\``), `root README misses ${name}`);
    });

    it('has README examples that pass the tool input schemas', () => {
      const examples = readmeExamples(readme, plugin.name);
      assert.ok(examples.length > 0, 'README has no `opentabs tool call` example');
      for (const { tool, json } of examples) assertAccepts(findTool(plugin, tool), JSON.parse(json));
    });
  });
}
