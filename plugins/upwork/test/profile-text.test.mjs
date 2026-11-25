import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';
import { findTool, loadPlugin } from '../../../test/plugin-contract.mjs';
import { parseProfileText, profileTextError } from '../dist/profile-text.js';
import { menuLabel, tokenNameFromButton } from '../dist/upwork-dom.js';

const pluginDir = fileURLToPath(new URL('..', import.meta.url));
const plugin = await loadPlugin(pluginDir);
const getProfile = findTool(plugin, 'get_profile');
const setProfileText = findTool(plugin, 'set_profile_text');
const setCategories = findTool(plugin, 'set_categories');

const profileText = [
  'Nav',
  'Jane Dev',
  '',
  '$80.00/hr',
  'I teach Skills workshops.',
  'more',
  'Skills',
  'Old skill that the later heading replaces',
  'Skills',
  'TypeScript',
  'Not Your project catalog tips',
  'Node.js',
  'Your project catalog',
  'Employment history',
  'Acme — Engineer',
  '(2)',
  'Show more',
  'Show less',
  'Other experiences',
  'Volunteer',
].join('\n');

describe('profile text', () => {
  it('reads the title above a blank line, the overview, and the last section', () => {
    assert.deepEqual(parseProfileText(profileText), {
      title: 'Jane Dev',
      rate: '$80.00/hr',
      overview: 'I teach Skills workshops.',
      skills: ['TypeScript', 'Not Your project catalog tips', 'Node.js'],
      employment: ['Acme — Engineer'],
    });
  });

  it('keeps a short overview when the page has no more link', () => {
    const text = ['Jane Dev', '$50.00/hr', 'Short overview without a more link.', 'Skills', 'Go'].join('\n');
    const parsed = parseProfileText(text);
    assert.equal(parsed.title, 'Jane Dev');
    assert.equal(parsed.overview, 'Short overview without a more link.');
    assert.deepEqual(parsed.skills, ['Go']);
    assert.deepEqual(parsed.employment, []);
  });

  it('returns empty title, rate, and overview when the rate line is missing', () => {
    assert.deepEqual(parseProfileText('Skills\nTypeScript\nYour project catalog'), {
      title: '',
      rate: '',
      overview: '',
      skills: ['TypeScript'],
      employment: [],
    });
  });

  it('rejects a long title, a long overview, and links before the editor opens', () => {
    assert.equal(profileTextError('title', 'A'.repeat(70)), null);
    assert.match(profileTextError('title', 'A'.repeat(71)), /70 characters/);
    assert.equal(profileTextError('overview', 'A'.repeat(5000)), null);
    assert.match(profileTextError('overview', 'A'.repeat(5001)), /5000 characters/);
    assert.match(profileTextError('overview', 'See https://example.com'), /links/);
    assert.match(profileTextError('overview', 'See www.example.com'), /links/);
    assert.equal(profileTextError('overview', 'www is a word'), null);
  });
});

describe('menu and token labels', () => {
  it('ignores a selected suffix and reads the skill name out of the remove button', () => {
    assert.equal(menuLabel('TypeScript\nSelected'), 'typescript');
    assert.equal(menuLabel('Go selected'), 'go');
    assert.equal(tokenNameFromButton('remove C++ tag'), 'C++');
    assert.equal(tokenNameFromButton('Remove Tag Tag'), 'Tag');
  });
});

describe('profile tools', { concurrency: false }, () => {
  it('reads the open freelancer page and refuses other Upwork pages', async () => {
    globalThis.location = { pathname: '/freelancers/~abc' };
    globalThis.document = { body: { innerText: profileText } };
    const result = await getProfile.handle({});
    assert.equal(result.title, 'Jane Dev');
    assert.equal(result.rate, '$80.00/hr');
    assert.deepEqual(result.skills, ['TypeScript', 'Not Your project catalog tips', 'Node.js']);

    globalThis.location = { pathname: '/nx/search/jobs' };
    await assert.rejects(() => getProfile.handle({}), /freelancers/);
  });

  it('rejects overview links and category edits off the settings page', async () => {
    await assert.rejects(
      () => setProfileText.handle({ section: 'overview', text: 'Visit www.example.com for details' }),
      /links/,
    );
    await assert.rejects(
      () => setProfileText.handle({ section: 'title', text: 'A'.repeat(71) }),
      /70 characters/,
    );
    globalThis.location = { pathname: '/freelancers/~abc' };
    await assert.rejects(
      () => setCategories.handle({ categories: ['Web Development'] }),
      /settings\/profile/,
    );
  });
});
