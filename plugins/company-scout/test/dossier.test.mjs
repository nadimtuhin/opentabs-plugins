import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';
import { findTool, loadPlugin } from '../../../test/plugin-contract.mjs';
import {
  FOUNDER_SELECTOR,
  PLATFORM_KEYWORDS,
  STACK_KEYWORDS,
  SUBTITLE_SELECTOR,
  companyName,
  extractDossier,
  founderNames,
  keywordHits,
  readCompanyPage,
} from '../dist/dossier.js';

const pluginDir = fileURLToPath(new URL('..', import.meta.url));
const plugin = await loadPlugin(pluginDir);
const extract = findTool(plugin, 'extract_company_dossier');

const meta = 'Acme helps clinics collect payments. It runs on AWS.';

function pageDoc({
  title = 'Ignored | Y Combinator',
  h1 = 'Acme',
  subtitle = 'Payments for clinics',
  description = meta,
  og = null,
  body = 'Acme builds on Node.js and Go.\ntoast is not this company.\nWe use PostgreSQL in production and ship with TypeScript.',
  founders = ['Jane Doe\nCEO', 'jane doe', 'Founded in 2019', 'CEO', 'Mary-Jane O\'Neil'],
} = {}) {
  return {
    title,
    body: { innerText: body },
    querySelector(selector) {
      if (selector === 'h1') return h1 ? { textContent: h1 } : null;
      if (selector === SUBTITLE_SELECTOR) return subtitle ? { textContent: subtitle } : null;
      if (selector === 'meta[name="description"]') {
        return description ? { getAttribute: () => description } : null;
      }
      if (selector === 'meta[property="og:description"]') return og ? { getAttribute: () => og } : null;
      return null;
    },
    querySelectorAll(selector) {
      if (selector === FOUNDER_SELECTOR) return founders.map(text => ({ textContent: text }));
      return [];
    },
  };
}

describe('company name, tagline, and keywords', () => {
  it('keeps a hyphenated name and does not copy the heading into the tagline', () => {
    assert.equal(companyName('Acme', 'Other | Y Combinator'), 'Acme');
    assert.equal(companyName('', 'Well-Known Labs | Y Combinator'), 'Well-Known Labs');
    assert.equal(companyName('', 'Well-Known Labs - Square App Marketplace'), 'Well-Known Labs');
    assert.equal(companyName('', ''), 'Unknown');
    assert.equal(companyName('', 'Just A Name'), 'Just A Name');
  });

  it('matches dotted and capitalized keywords and ignores lookalikes', () => {
    const text = 'Node.js, typescript, Go. Go-to-market, NodeXjs, toast, epic, aws.amazon.com, Shopify, Epic FHIR';
    assert.deepEqual(keywordHits(text, STACK_KEYWORDS), ['TypeScript', 'Node.js', 'Go']);
    assert.deepEqual(keywordHits(text, PLATFORM_KEYWORDS), ['Shopify', 'Epic', 'FHIR']);
  });

  it('reads a subtitle, meta description, and founder first lines from the page', () => {
    const dossier = extractDossier(
      readCompanyPage(pageDoc(), 'https://www.ycombinator.com/companies/acme'),
    );
    assert.equal(dossier.name, 'Acme');
    assert.equal(dossier.tagline, 'Payments for clinics');
    assert.equal(dossier.description, meta);
    assert.deepEqual(dossier.detected_platforms, []);
    assert.deepEqual(dossier.detected_stack, ['TypeScript', 'Node.js', 'PostgreSQL', 'AWS', 'Go']);
    assert.deepEqual(dossier.founders, ['Jane Doe', "Mary-Jane O'Neil"]);
    assert.equal(dossier.url, 'https://www.ycombinator.com/companies/acme');
  });

  it('falls back to the meta description and caps a long description', () => {
    const first = 'A'.repeat(40);
    const long = `${first}. ${'B'.repeat(500)}`;
    const dossier = extractDossier(
      readCompanyPage(
        pageDoc({
          h1: '',
          title: 'Well-Known Labs | Y Combinator',
          subtitle: 'Well-Known Labs',
          description: null,
          og: long,
          body: 'short',
          founders: [],
        }),
        'https://example.test/co',
      ),
    );
    assert.equal(dossier.name, 'Well-Known Labs');
    assert.equal(dossier.tagline, `${first}.`);
    assert.equal(dossier.description.length, 500);
    assert.deepEqual(founderNames(['Team', 'A very long sentence about the founding team and mission']), []);
  });

  it('uses a body line when the page has no meta description', () => {
    const dossier = extractDossier(
      readCompanyPage(
        pageDoc({
          subtitle: '',
          description: '   ',
          og: null,
          body: 'Acme\n\nAcme builds payments software for independent clinics across the country.',
          founders: [],
        }),
        'https://example.test/acme',
      ),
    );
    assert.equal(dossier.tagline, '');
    assert.equal(dossier.description, 'Acme builds payments software for independent clinics across the country.');
  });
});

describe('extract_company_dossier', { concurrency: false }, () => {
  it('returns the dossier for the open tab', async () => {
    globalThis.document = pageDoc();
    globalThis.location = { href: 'https://www.ycombinator.com/companies/acme' };
    const result = await extract.handle({});
    assert.equal(result.name, 'Acme');
    assert.equal(result.tagline, 'Payments for clinics');
    assert.deepEqual(result.founders, ['Jane Doe', "Mary-Jane O'Neil"]);
  });
});
