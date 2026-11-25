import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';
import { findTool, loadPlugin } from '../../../test/plugin-contract.mjs';
import {
  applyStep,
  coverLetterError,
  fieldKey,
  isSaveButtonLabel,
  optionLabel,
  profileSection,
  validationLines,
} from '../dist/form-rules.js';

const pluginDir = fileURLToPath(new URL('..', import.meta.url));
const plugin = await loadPlugin(pluginDir);
const getApplyState = findTool(plugin, 'get_apply_state');
const fillCoverLetter = findTool(plugin, 'fill_cover_letter');
const getProfileForm = findTool(plugin, 'get_profile_form');
const fillProfileFields = findTool(plugin, 'fill_profile_fields');
const saveProfile = findTool(plugin, 'save_profile');
const setYear = findTool(plugin, 'set_year');

describe('form rules', () => {
  it('bounds the cover letter and names the wizard step', () => {
    assert.equal(coverLetterError('A'.repeat(380)), null);
    assert.equal(coverLetterError('A'.repeat(2000)), null);
    assert.match(coverLetterError('Hello'), /380-2000 chars, got 5/);
    assert.match(coverLetterError('A'.repeat(2001)), /got 2001/);
    assert.equal(applyStep(true, true), 'cover_letter');
    assert.equal(applyStep(false, true), 'rate');
    assert.equal(applyStep(false, false), 'other');
  });

  it('prefers the field name, ignores a trailing slash, and skips the wrong Save button', () => {
    assert.equal(fieldKey('title', 'profile-title'), 'title');
    assert.equal(fieldKey('', 'profile-title'), 'profile-title');
    assert.equal(profileSection('/talent/abc/settings/profile/skills/'), 'skills');
    assert.equal(profileSection('/talent/abc/settings/profile/'), 'profile');
    assert.equal(isSaveButtonLabel('Save'), true);
    assert.equal(isSaveButtonLabel('Save changes'), true);
    assert.equal(isSaveButtonLabel('Save and Add Another'), false);
    assert.equal(isSaveButtonLabel('Saved'), false);
    assert.deepEqual(validationLines('Please enter a title\nAll good\nCity is required'), [
      'Please enter a title',
      'City is required',
    ]);
    assert.equal(optionLabel('Fintech\nSoftware'), 'Fintech');
    assert.equal(optionLabel('  AI   Apps  '), 'AI Apps');
  });
});

describe('apply and profile tools', { concurrency: false }, () => {
  it('reads the apply step from the open form', async () => {
    globalThis.location = { pathname: '/jobs/1/apply', href: 'https://talent.toptal.com/jobs/1/apply' };
    globalThis.document = {
      title: 'Staff Engineer. Talent Portal',
      querySelector(selector) {
        if (selector.includes('textarea')) return { value: 'hi' };
        if (selector.includes('requestedRate')) return { value: '80' };
        if (selector.includes('understand')) return { checked: true };
        return null;
      },
    };
    const state = await getApplyState.handle({});
    assert.deepEqual(state, {
      title: 'Staff Engineer',
      step: 'cover_letter',
      rate: '80',
      pitch_length: 2,
      terms_checked: true,
    });

    globalThis.location = { pathname: '/home', href: 'https://talent.toptal.com/home' };
    await assert.rejects(() => getApplyState.handle({}), /\/apply/);
  });

  it('rejects a short cover letter before looking for the textarea', async () => {
    await assert.rejects(() => fillCoverLetter.handle({ text: 'Hello' }), /Letter must be 380-2000 chars, got 5/);
  });

  it('reports the profile section and the real Save button', async () => {
    globalThis.location = {
      pathname: '/talent/abc/settings/profile/skills/',
      href: 'https://talent.toptal.com/talent/abc/settings/profile/skills/',
    };
    class Input {
      constructor(props) {
        Object.assign(this, props);
      }
    }
    globalThis.HTMLInputElement = Input;
    const title = new Input({
      type: 'text',
      id: 'profile-title',
      name: 'title',
      tagName: 'INPUT',
      value: 'Engineer',
      checked: false,
      getAttribute: () => null,
    });
    globalThis.document = {
      body: { innerText: 'Between 250 and 500 characters' },
      querySelectorAll(selector) {
        if (selector === 'button') {
          return [{ innerText: 'Save and Add Another' }, { innerText: 'Saved' }, { innerText: 'Save changes' }];
        }
        if (selector === 'input, textarea') return [title];
        return [];
      },
    };
    const form = await getProfileForm.handle({});
    assert.equal(form.section, 'skills');
    assert.equal(form.save_button, 'Save changes');
    assert.deepEqual(form.fields, [{ key: 'title', type: 'text', value: 'Engineer', checked: false, invalid: false }]);
    assert.deepEqual(form.hints, ['Between 250 and 500 characters']);

    await assert.rejects(
      () => fillProfileFields.handle({ fields: { missing: 'x' } }),
      /Unknown field keys: missing/,
    );
  });

  it('refuses set_year and save_profile off a profile edit page', async () => {
    globalThis.location = { pathname: '/jobs/1/apply', href: 'https://talent.toptal.com/jobs/1/apply' };
    await assert.rejects(() => setYear.handle({ field: 'startDate', year: 2020 }), /settings\/profile/);
    await assert.rejects(() => saveProfile.handle({}), /settings\/profile/);
  });
});
