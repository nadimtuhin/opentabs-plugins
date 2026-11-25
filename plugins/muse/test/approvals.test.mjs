import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';
import { findTool, loadPlugin } from '../../../test/plugin-contract.mjs';
import { cards, describeCard, findButton } from '../dist/muse-dom.js';

const pluginDir = fileURLToPath(new URL('..', import.meta.url));
const plugin = await loadPlugin(pluginDir);
const listApprovals = findTool(plugin, 'list_approvals');
const respond = findTool(plugin, 'respond_approval');

class El {
  constructor(tag, attrs = {}, text = '') {
    this.tag = tag;
    this.attrs = { ...attrs };
    this.text = text;
    this.children = [];
    this.offsetParent = {};
    this.disabled = false;
    this.clicked = false;
  }

  getAttribute(name) {
    return Object.hasOwn(this.attrs, name) ? this.attrs[name] : null;
  }

  append(child) {
    this.children.push(child);
    return child;
  }

  get innerText() {
    return [this.text, ...this.children.map(child => child.innerText)].filter(Boolean).join('\n');
  }

  querySelectorAll(selector) {
    const out = [];
    const walk = node => {
      if (matches(node, selector)) out.push(node);
      for (const child of node.children) walk(child);
    };
    for (const child of this.children) walk(child);
    return out;
  }

  querySelector(selector) {
    return this.querySelectorAll(selector)[0];
  }

  click() {
    this.clicked = true;
  }
}

function matchOne(el, sel) {
  let i = 0;
  if (/^[a-zA-Z]/.test(sel)) {
    const tag = sel.match(/^[a-zA-Z0-9-]+/)[0];
    if (el.tag.toLowerCase() !== tag.toLowerCase()) return false;
    i = tag.length;
  }
  while (i < sel.length) {
    if (sel[i] === '[') {
      const end = sel.indexOf(']', i);
      const body = sel.slice(i + 1, end);
      i = end + 1;
      const eq = body.match(/^([^=]+)="(.*)"$/);
      if (eq) {
        if (el.getAttribute(eq[1]) !== eq[2]) return false;
      } else if (el.getAttribute(body) == null) return false;
    } else if (sel.startsWith(':not(', i)) {
      let depth = 1;
      let j = i + 5;
      for (; j < sel.length && depth; j++) {
        if (sel[j] === '(') depth++;
        else if (sel[j] === ')') depth--;
      }
      if (matchOne(el, sel.slice(i + 5, j - 1))) return false;
      i = j;
    } else {
      return false;
    }
  }
  return true;
}

function matches(el, selector) {
  return selector.split(',').some(part => matchOne(el, part.trim()));
}

function button(label, { aria, primary = false, disabled = false, role = false } = {}) {
  const attrs = {};
  if (aria) attrs['aria-label'] = aria;
  if (primary) attrs['data-hatch-approval-primary-action'] = 'true';
  if (role) attrs.role = 'button';
  const el = new El(role ? 'div' : 'button', attrs, label);
  el.disabled = disabled;
  return el;
}

function card(text, buttons, { surface = 'chat', background = false, hidden = false } = {}) {
  const attrs = { 'data-testid': 'hatch-inline-approval-card', 'data-hatch-approval-surface': surface };
  if (background) attrs['data-hatch-background-approval-surface'] = 'true';
  const el = new El('div', attrs, text);
  if (hidden) el.offsetParent = null;
  for (const child of buttons) el.append(child);
  return el;
}

function install(nodes) {
  const document = new El('document');
  for (const node of nodes) document.append(node);
  globalThis.document = document;
  return document;
}

const foreground = () =>
  card('github.com wants to run a command', [
    button('拒絕', { aria: 'Deny' }),
    button('Allow', { primary: true }),
    button('Always', { aria: 'Always allow' }),
    button('Block', { disabled: true }),
  ]);

describe('approval cards', () => {
  it('lists visible foreground cards and prefers aria-labels', () => {
    const hidden = card('secret', [button('Allow')], { hidden: true });
    const background = card('background', [button('Allow')], { background: true, surface: 'panel' });
    const once = card('clipboard', [button('Allow once', { aria: '允許一次', primary: true })], { surface: 'panel' });
    install([foreground(), hidden, background, once]);

    const found = cards();
    assert.equal(found.length, 2);
    assert.deepEqual(describeCard(found[0], 0), {
      index: 0,
      surface: 'chat',
      text: 'github.com wants to run a command 拒絕 Allow Always Block',
      buttons: ['Deny', 'Allow', 'Always allow'],
    });
    assert.equal(describeCard(found[1], 1).surface, 'panel');
  });

  it('picks allow, always, and deny, including the Chinese labels', () => {
    const english = foreground();
    assert.equal(findButton(english, 'deny').getAttribute('aria-label'), 'Deny');
    assert.equal(findButton(english, 'allow').innerText, 'Allow');
    assert.equal(findButton(english, 'always').getAttribute('aria-label'), 'Always allow');

    const zh = card('部署到生产', [button('拒绝'), button('允许'), button('总是允许')]);
    assert.equal(findButton(zh, 'deny').innerText, '拒绝');
    assert.equal(findButton(zh, 'allow').innerText, '允许');
    assert.equal(findButton(zh, 'always').innerText, '总是允许');

    const fallback = card('notes', [button('Continue', { primary: true })]);
    assert.equal(findButton(fallback, 'allow').innerText, 'Continue');
    assert.equal(findButton(fallback, 'always').innerText, 'Continue');
    assert.equal(findButton(fallback, 'deny'), undefined);

    const onceOnly = card('notes', [button('Allow this time')]);
    assert.equal(findButton(onceOnly, 'always').innerText, 'Allow this time');
    const role = card('notes', [button("Don't send", { role: true })]);
    assert.equal(findButton(role, 'deny').innerText, "Don't send");
  });
});

describe('respond_approval', () => {
  it('clicks the chosen button only when the card text still matches', async () => {
    install([foreground()]);
    const result = await respond.handle({ index: 0, decision: 'always', expect_text: 'github.com' });
    assert.equal(result.clicked, 'Always allow');
    assert.equal(cards()[0].querySelector('[aria-label="Always allow"]').clicked, true);
    assert.equal(cards()[0].querySelector('[aria-label="Deny"]').clicked, false);

    const listed = await listApprovals.handle({});
    assert.equal(listed.approvals.length, 1);
    assert.equal(listed.approvals[0].index, 0);
    assert.deepEqual(listed.approvals[0].buttons, ['Deny', 'Allow', 'Always allow']);
  });

  it('refuses a stale index, changed text, or a missing deny button', async () => {
    install([card('clipboard', [button('Allow', { primary: true })])]);
    await assert.rejects(respond.handle({ index: 3, decision: 'allow', expect_text: 'clipboard' }), /No approval card at index 3/);
    await assert.rejects(
      respond.handle({ index: 0, decision: 'allow', expect_text: 'github.com' }),
      /does not contain expect_text/,
    );
    await assert.rejects(respond.handle({ index: 0, decision: 'deny', expect_text: 'clipboard' }), /No deny button/);
  });
});
