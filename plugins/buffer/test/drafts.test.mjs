import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';
import { findTool, loadPlugin } from '../../../test/plugin-contract.mjs';
import { draftMatches, parseEditLabel, readDrafts } from '../dist/buffer-dom.js';

const pluginDir = fileURLToPath(new URL('..', import.meta.url));
const plugin = await loadPlugin(pluginDir);
const listDrafts = findTool(plugin, 'list_drafts');
const scheduleDrafts = findTool(plugin, 'schedule_drafts');

class Btn {
  constructor(text, aria = null) {
    this.text = text;
    this.aria = aria;
    this.clicked = false;
  }

  get innerText() {
    return this.text;
  }

  getAttribute(name) {
    return name === 'aria-label' ? this.aria : null;
  }

  click() {
    this.clicked = true;
  }

  scrollIntoView() {}
}

class Tab {
  constructor(text) {
    this.text = text;
  }

  get innerText() {
    return this.text;
  }
}

function install({ open = true, tabs = ['Queue 4', 'Drafts 2'], buttons = [] } = {}) {
  globalThis.document = {
    querySelector(selector) {
      if (selector === '#drafts-tab') return { getAttribute: () => (open ? 'true' : 'false') };
      return null;
    },
    querySelectorAll(selector) {
      if (selector === '[role=tab]') return tabs.map(text => new Tab(text));
      if (selector === 'main button') return buttons;
      return [];
    },
  };
  return { buttons };
}

const longPreview = 'Tips for founders who ship browser tools';

describe('draft labels', { concurrency: false }, () => {
  it('keeps text inside the quotes, including " for ", and strips a trailing ellipsis', () => {
    assert.deepEqual(parseEditLabel(`Edit draft "${longPreview}…" for LinkedIn created yesterday`), {
      preview: longPreview,
      channel: 'LinkedIn',
      truncated: true,
    });
    assert.deepEqual(parseEditLabel('Edit draft "Hello…world" for X created just now'), {
      preview: 'Hello…world',
      channel: 'X',
      truncated: false,
    });
    assert.equal(parseEditLabel('Edit draft "…" for X created'), null);
    assert.equal(parseEditLabel('Schedule Post'), null);
  });

  it('pairs each edit label with the action button in front of it', () => {
    const schedule = new Btn('Schedule Post');
    const queue = new Btn('Add to Queue');
    const orphan = new Btn('Edit draft "Skipped" for X created', 'Edit draft "Skipped" for X created');
    install({
      buttons: [
        orphan,
        schedule,
        new Btn('Edit', `Edit draft "${longPreview}…" for LinkedIn created yesterday`),
        queue,
        new Btn('Edit', 'Edit draft "Hello…world" for X created just now'),
      ],
    });
    assert.deepEqual(
      readDrafts().map(({ preview, channel, truncated, schedulable }) => ({
        preview,
        channel,
        truncated,
        schedulable,
      })),
      [
        { preview: longPreview, channel: 'LinkedIn', truncated: true, schedulable: true },
        { preview: 'Hello…world', channel: 'X', truncated: false, schedulable: false },
      ],
    );
    assert.equal(schedule.clicked, false);
    assert.equal(queue.clicked, false);
  });

  it('matches a prefix, and a longer string only when the preview was truncated', () => {
    const truncated = { preview: longPreview, truncated: true };
    const whole = { preview: 'Hello', truncated: false };
    assert.equal(draftMatches(truncated, 'Tips for'), true);
    assert.equal(draftMatches(truncated, `${longPreview} and the rest of the post`), true);
    assert.equal(draftMatches(whole, 'Hello world'), false);
    assert.equal(draftMatches({ preview: 'The', truncated: true }, 'The quarterly update'), false);
  });
});

describe('draft tools', { concurrency: false }, () => {
  it('lists previews and the queue count from the open Drafts tab', async () => {
    install({
      buttons: [
        new Btn('Schedule Post'),
        new Btn('Edit', `Edit draft "${longPreview}…" for LinkedIn created yesterday`),
      ],
    });
    const listed = await listDrafts.handle({});
    assert.equal(listed.queue, 4);
    assert.equal(listed.drafts_total, 2);
    assert.deepEqual(listed.drafts, [
      { index: 0, preview: longPreview, channel: 'LinkedIn', schedulable: true },
    ]);
  });

  it('stops without clicking when the tab is closed, nothing matches, or two drafts match', async () => {
    install({ open: false });
    await assert.rejects(() => scheduleDrafts.handle({ match: ['Tips for founders'] }), /Drafts tab is not open/);

    const first = new Btn('Schedule Post');
    const second = new Btn('Schedule Post');
    install({
      buttons: [
        first,
        new Btn('Edit', `Edit draft "${longPreview}…" for LinkedIn created yesterday`),
        second,
        new Btn('Edit', 'Edit draft "Tips for teams" for X created yesterday'),
      ],
    });
    const none = await scheduleDrafts.handle({ match: ['zzzz unique'] });
    assert.equal(none.results[0].reason, 'no draft matches');
    assert.equal(first.clicked, false);

    const ambiguous = await scheduleDrafts.handle({ match: ['Tips'] });
    assert.match(ambiguous.results[0].reason, /2 drafts match/);
    assert.equal(first.clicked, false);
    assert.equal(second.clicked, false);
  });

  it('refuses a draft that only has Add to Queue', async () => {
    const queue = new Btn('Add to Queue');
    install({
      buttons: [queue, new Btn('Edit', 'Edit draft "I had an AI agent" for X created yesterday')],
    });
    const result = await scheduleDrafts.handle({ match: ['I had an AI agent'] });
    assert.equal(result.results[0].ok, false);
    assert.match(result.results[0].reason, /no time set/);
    assert.equal(queue.clicked, false);
  });
});
