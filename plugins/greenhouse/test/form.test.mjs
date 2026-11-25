import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { parseHTML } from 'linkedom';
import { fileURLToPath } from 'node:url';
import { findTool, loadPlugin } from '../../../test/plugin-contract.mjs';
import { applyAnswer, findField, readFields } from '../dist/greenhouse-form.js';

const pluginDir = fileURLToPath(new URL('..', import.meta.url));
const plugin = await loadPlugin(pluginDir);
const getFormTool = findTool(plugin, 'get_application_form');
const fillTool = findTool(plugin, 'fill_application');

const FORM = `
<h1>Platform Engineer</h1>
<form id="application-form">
  <label for="first_name">First name *</label>
  <input id="first_name" required value="">
  <label for="last_name">Last name</label>
  <input id="last_name" value="Tuhin">
  <textarea id="website" aria-label="Personal website"></textarea>
  <div class="select__container">
    <input id="country" class="select__input" role="combobox" aria-required="true" aria-labelledby="country-label">
  </div>
  <span id="country-label">Country</span>
  <fieldset>
    <legend>Languages *</legend>
    <label for="lang_0">TypeScript</label>
    <input id="lang_0" type="checkbox" name="languages">
    <label for="lang_1">Go</label>
    <input id="lang_1" type="checkbox" name="languages" required>
  </fieldset>
  <div id="upload-label-resume">Resume/CV</div>
  <input id="resume" type="file" required>
  <input type="hidden" id="secret" value="x">
</form>`;

function installForm(html = FORM) {
  const window = parseHTML(`<!doctype html><html><head><title>Fallback title</title></head><body>${html}</body></html>`);
  globalThis.document = window.document;
  globalThis.HTMLInputElement = window.HTMLInputElement;
  globalThis.HTMLTextAreaElement = window.HTMLTextAreaElement;
  globalThis.Event = window.Event;
  globalThis.location = { href: 'https://job-boards.greenhouse.io/acme/jobs/1' };
  globalThis.CSS = {
    escape: value => String(value).replace(/[^a-zA-Z0-9_-]/g, char => `\\${char}`),
  };
  for (const ctor of [window.HTMLInputElement, window.HTMLTextAreaElement]) {
    const target = ctor.prototype;
    if (!Object.getOwnPropertyDescriptor(target, 'required')) {
      Object.defineProperty(target, 'required', {
        configurable: true,
        get() {
          return this.hasAttribute('required');
        },
      });
    }
  }
  const proto = window.HTMLInputElement.prototype;
  if (!Object.hasOwn(proto, 'checked')) {
    Object.defineProperty(proto, 'checked', {
      configurable: true,
      get() {
        return this._checked === true;
      },
      set(value) {
        this._checked = value === true;
      },
    });
    const click = proto.click;
    proto.click = function clickCheckbox() {
      if (this.type === 'checkbox') this.checked = !this.checked;
      return click?.call(this);
    };
  }
  for (const box of window.document.querySelectorAll('input[type=checkbox]')) {
    box.checked = box.hasAttribute('checked');
  }
  return window.document;
}

function attachCountrySelect() {
  const input = document.getElementById('country');
  const box = input.closest('.select__container');
  const options = [
    { label: 'Europe', options: [{ label: 'Germany', value: 'de' }, { label: 'France', value: 'fr' }] },
    { label: 'Bangladesh', value: 'bd' },
  ];
  input.__reactFiber$test = {
    return: null,
    stateNode: {
      props: { options, isMulti: false, value: null },
      selectOption(option) {
        let shown = box.querySelector('.select__single-value');
        if (!shown) {
          shown = document.createElement('div');
          shown.className = 'select__single-value';
          box.prepend(shown);
        }
        shown.textContent = option.label;
      },
    },
  };
}

describe('greenhouse form reading', () => {
  it('reads labels, types, requirements, and skips hidden inputs', () => {
    installForm();
    attachCountrySelect();
    const fields = readFields();
    assert.deepEqual(
      fields.map(field => [field.id, field.type, field.label, field.required]),
      [
        ['first_name', 'text', 'First name', true],
        ['last_name', 'text', 'Last name', false],
        ['website', 'textarea', 'Personal website', false],
        ['country', 'select', 'Country', true],
        ['languages', 'checkboxes', 'Languages', true],
        ['resume', 'file', 'Resume/CV', true],
      ],
    );
    assert.equal(fields.find(field => field.id === 'last_name').value, 'Tuhin');
    assert.deepEqual(fields.find(field => field.id === 'country').options, ['Germany', 'France', 'Bangladesh']);
    assert.deepEqual(fields.find(field => field.id === 'languages').options, ['TypeScript', 'Go']);
    assert.deepEqual(fields.find(field => field.id === 'resume').value, []);
  });

  it('finds a field by id, then by label text, then by every word', () => {
    installForm();
    assert.equal(findField('first_name').label, 'First name');
    assert.equal(findField('LAST').id, 'last_name');
    assert.equal(findField('personal site').id, 'website');
    assert.equal(findField('which stack'), null);
  });

  it('reports the job and the required fields that are still empty', async () => {
    installForm();
    attachCountrySelect();
    const result = await getFormTool.handle({});
    assert.equal(result.job_title, 'Platform Engineer');
    assert.equal(result.url, 'https://job-boards.greenhouse.io/acme/jobs/1');
    assert.deepEqual(result.missing_required, ['First name', 'Country', 'Languages', 'Resume/CV']);
  });

  it('uses the document title when the page has no heading', async () => {
    installForm(FORM.replace('<h1>Platform Engineer</h1>', ''));
    const result = await getFormTool.handle({});
    assert.equal(result.job_title, 'Fallback title');
  });

  it('refuses to read a page with no application form', async () => {
    installForm('<p>No form here</p>');
    await assert.rejects(getFormTool.handle({}), /No Greenhouse application form/);
  });
});

describe('greenhouse answer matching', () => {
  it('fills text, matches dropdown options, and checks boxes without submitting', () => {
    installForm();
    attachCountrySelect();
    assert.equal(applyAnswer(findField('first_name'), 'Nadim'), 'Nadim');
    assert.equal(document.getElementById('first_name').value, 'Nadim');
    assert.deepEqual(applyAnswer(findField('country'), 'fr'), ['France']);
    assert.deepEqual(applyAnswer(findField('country'), 'Bangladesh'), ['Bangladesh']);
    assert.deepEqual(applyAnswer(findField('languages'), ['go', 'typescript']), ['TypeScript', 'Go']);
    assert.equal(document.querySelector('button, [type=submit]'), null);
  });

  it('rejects unknown options, search-only dropdowns, and file fields', () => {
    installForm();
    attachCountrySelect();
    assert.throws(() => applyAnswer(findField('country'), 'Mars'), /no option matching "Mars"/);
    document.getElementById('country').__reactFiber$test.stateNode.props.options = [];
    assert.throws(() => applyAnswer(findField('country'), 'France'), /loads options from a search/);
    delete document.getElementById('country').__reactFiber$test;
    assert.throws(() => applyAnswer(findField('country'), 'France'), /dropdown component not found/);
    assert.throws(() => applyAnswer(findField('languages'), ['Rust']), /no option matching "Rust"/);
    assert.throws(() => applyAnswer(findField('resume'), 'cv.pdf'), /file fields need attach_file/);
  });

  it('records filled values and leaves unknown keys failed', async () => {
    installForm();
    attachCountrySelect();
    const result = await fillTool.handle({
      answers: {
        first_name: 'Nadim',
        country: 'ger',
        languages: ['Go'],
        hometown: 'Dhaka',
      },
    });
    assert.deepEqual(result.filled, [
      { key: 'first_name', label: 'First name', value: 'Nadim' },
      { key: 'country', label: 'Country', value: ['Germany'] },
      { key: 'languages', label: 'Languages', value: ['Go'] },
    ]);
    assert.deepEqual(result.failed, [{ key: 'hometown', error: 'no field with this id or label' }]);
    assert.deepEqual(result.missing_required, ['Resume/CV']);
  });
});
