import { defineTool } from '@opentabs-dev/plugin-sdk';
import { z } from 'zod';

export const extractCompanyDossier = defineTool({
  name: 'extract_company_dossier',
  displayName: 'Extract Company Dossier',
  description:
    'Extract company name, tagline, description, detected platform integrations, and team signals from the current startup or marketplace tab.',
  icon: 'search',
  input: z.object({}),
  output: z.object({
    name: z.string(),
    url: z.string(),
    tagline: z.string(),
    description: z.string(),
    detected_platforms: z.array(z.string()),
    detected_stack: z.array(z.string()),
    founders: z.array(z.string()),
  }),
  handle: async () => {
    const title = document.title;
    const h1 = document.querySelector('h1')?.textContent?.trim() ?? '';
    const name = h1 || title.split('|')[0]?.split('-')[0]?.trim() || 'Unknown';

    const metaDesc =
      document.querySelector('meta[name="description"]')?.getAttribute('content') ??
      document.querySelector('meta[property="og:description"]')?.getAttribute('content') ??
      '';

    const bodyText = document.body.innerText || '';

    // Platform detection
    const platformKeywords = ['Square', 'Toast', 'Clover', 'Shopify', 'Epic', 'FHIR', 'Chromium', 'Playwright', 'Puppeteer'];
    const detectedPlatforms = platformKeywords.filter((kw) =>
      new RegExp(`\\b${kw}\\b`, 'i').test(bodyText)
    );

    // Tech stack detection
    const stackKeywords = ['TypeScript', 'Node.js', 'Python', 'PostgreSQL', 'Redis', 'Kafka', 'Docker', 'AWS', 'Kubernetes', 'Go'];
    const detectedStack = stackKeywords.filter((kw) =>
      new RegExp(`\\b${kw}\\b`, 'i').test(bodyText)
    );

    // Founders detection from common selector patterns (YC or team sections)
    const founderElements = document.querySelectorAll(
      '[data-testid*="founder"], .founder, .team-member, [class*="Founder"]'
    );
    const founders: string[] = [];
    for (const el of Array.from(founderElements)) {
      const text = el.textContent?.trim();
      if (text && text.length < 50 && !founders.includes(text)) {
        founders.push(text);
      }
    }

    return {
      name,
      url: location.href,
      tagline: h1,
      description: metaDesc.slice(0, 500),
      detected_platforms: detectedPlatforms,
      detected_stack: detectedStack,
      founders: founders.slice(0, 5),
    };
  },
});
