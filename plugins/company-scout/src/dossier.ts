// Pure page reading for extract_company_dossier. The tool only supplies the live document.

export const PLATFORM_KEYWORDS = [
  'Square',
  'Toast',
  'Clover',
  'Shopify',
  'Epic',
  'FHIR',
  'Chromium',
  'Playwright',
  'Puppeteer',
] as const;

export const STACK_KEYWORDS = [
  'TypeScript',
  'Node.js',
  'Python',
  'PostgreSQL',
  'Redis',
  'Kafka',
  'Docker',
  'AWS',
  'Kubernetes',
  'Go',
] as const;

// These are also ordinary words or show up lowercased inside URLs ("aws.amazon.com", "go to").
const CASE_SENSITIVE = new Set<string>(['Square', 'Toast', 'Clover', 'Epic', 'Go', 'AWS']);

export const SUBTITLE_SELECTOR = 'h1 + p, h1 + h2, [data-testid*="tagline"], .tagline';
export const FOUNDER_SELECTOR = '[data-testid*="founder"], .founder, .team-member, [class*="Founder"]';

export interface PageBits {
  title: string;
  h1: string;
  subtitle: string;
  metaDescription: string;
  bodyText: string;
  founderTexts: string[];
  url: string;
}

export interface CompanyDossier {
  name: string;
  url: string;
  tagline: string;
  description: string;
  detected_platforms: string[];
  detected_stack: string[];
  founders: string[];
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// Hyphen is part of the token so "Go-to-market" is not Go and "Node.js" does not match "NodeXjs".
export function keywordHits(text: string, keywords: readonly string[]): string[] {
  return keywords.filter(kw => {
    const flags = CASE_SENSITIVE.has(kw) ? 'u' : 'iu';
    const pattern = new RegExp(`(?<![\\p{L}\\p{N}_-])${escapeRegExp(kw)}(?![\\p{L}\\p{N}_-])`, flags);
    return pattern.test(text);
  });
}

export function companyName(h1: string, title: string): string {
  const heading = h1.trim();
  if (heading) return heading;
  // Split on a spaced separator only. "Well-Known Labs | Y Combinator" must stay "Well-Known Labs".
  const fromTitle = title.split(/\s+[|–—-]\s+/)[0]?.trim() ?? '';
  return fromTitle || 'Unknown';
}

export function companyTagline(name: string, subtitle: string, meta: string): string {
  const sub = subtitle.replace(/\s+/g, ' ').trim();
  if (sub && sub.toLowerCase() !== name.toLowerCase() && sub.length <= 180) return sub;
  const first =
    meta
      .trim()
      .split(/(?<=[.!?])\s+/)[0]
      ?.trim() ?? '';
  if (first && first.toLowerCase() !== name.toLowerCase() && first.length <= 180) return first;
  return '';
}

export function companyDescription(meta: string, bodyText: string, name: string, tagline: string): string {
  const clean = meta.replace(/\s+/g, ' ').trim();
  if (clean) return clean.slice(0, 500);
  const lines = bodyText
    .split('\n')
    .map(line => line.trim())
    .filter(Boolean);
  const para = lines.find(line => line !== name && line !== tagline && line.length >= 40);
  return (para ?? '').slice(0, 500);
}

const ROLE = /^(founder|co-founder|cofounder|ceo|cto|cfo|coo|team|member|advisor|board)$/i;
const NAME = /^[\p{L}][\p{L}.'’() -]*[\p{L}.]$/u;

export function founderNames(texts: string[]): string[] {
  const out: string[] = [];
  for (const raw of texts) {
    const line = (raw.split('\n').find(part => part.trim()) ?? '').replace(/\s+/g, ' ').trim();
    const withoutRole = line.replace(/,?\s+(CEO|CTO|CFO|COO|Co-founder|Cofounder|Founder)$/i, '').trim();
    if (!withoutRole || ROLE.test(withoutRole)) continue;
    if (withoutRole.length < 2 || withoutRole.length > 40) continue;
    if (withoutRole.split(' ').length > 4) continue;
    if (!NAME.test(withoutRole)) continue;
    if (out.some(existing => existing.toLowerCase() === withoutRole.toLowerCase())) continue;
    out.push(withoutRole);
    if (out.length === 5) break;
  }
  return out;
}

export function extractDossier(page: PageBits): CompanyDossier {
  const name = companyName(page.h1, page.title);
  const tagline = companyTagline(name, page.subtitle, page.metaDescription);
  const haystack = `${page.bodyText}\n${page.metaDescription}`;
  return {
    name,
    url: page.url,
    tagline,
    description: companyDescription(page.metaDescription, page.bodyText, name, tagline),
    detected_platforms: keywordHits(haystack, PLATFORM_KEYWORDS),
    detected_stack: keywordHits(haystack, STACK_KEYWORDS),
    founders: founderNames(page.founderTexts),
  };
}

export function readCompanyPage(doc: Document, url: string): PageBits {
  const metaDescription =
    doc.querySelector('meta[name="description"]')?.getAttribute('content') ??
    doc.querySelector('meta[property="og:description"]')?.getAttribute('content') ??
    '';
  return {
    title: doc.title,
    h1: doc.querySelector('h1')?.textContent?.trim() ?? '',
    subtitle: doc.querySelector(SUBTITLE_SELECTOR)?.textContent?.trim() ?? '',
    metaDescription,
    bodyText: doc.body?.innerText ?? '',
    founderTexts: [...doc.querySelectorAll(FOUNDER_SELECTOR)].map(el => el.textContent ?? ''),
    url,
  };
}
