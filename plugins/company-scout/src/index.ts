import './jitless.js';
import { OpenTabsPlugin } from '@opentabs-dev/plugin-sdk';
import type { ToolDefinition } from '@opentabs-dev/plugin-sdk';
import { extractCompanyDossier } from './tools/extract-company.js';

class CompanyScoutPlugin extends OpenTabsPlugin {
  readonly name = 'company-scout';
  readonly description = 'Extract company profiles, leadership, and tech stack signals from startup directories and marketplaces.';
  override readonly displayName = 'Company Scout';
  readonly urlPatterns = [
    '*://*.ycombinator.com/companies/*',
    '*://*.squareup.com/us/en/app-marketplace/*',
    '*://*.squareup.com/app-marketplace/*',
  ];
  readonly tools: ToolDefinition[] = [extractCompanyDossier];

  async isReady(): Promise<boolean> {
    return typeof document !== 'undefined';
  }
}

export default new CompanyScoutPlugin();
