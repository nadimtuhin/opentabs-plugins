import { defineTool } from '@opentabs-dev/plugin-sdk';
import { z } from 'zod';
import { extractDossier, readCompanyPage, type CompanyDossier } from '../dossier.js';

export const extractCompanyDossier = defineTool({
  name: 'extract_company_dossier',
  displayName: 'Extract Company Dossier',
  description:
    'Extract company name, tagline, description, detected platform integrations, and team signals from the current startup or marketplace tab. The tagline is the subtitle under the heading, or the first sentence of the meta description. It is not a copy of the company name.',
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
  handle: async (): Promise<CompanyDossier> => extractDossier(readCompanyPage(document, location.href)),
});
