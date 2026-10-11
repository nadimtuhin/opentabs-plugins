import './jitless.js';
import { OpenTabsPlugin } from '@opentabs-dev/plugin-sdk';
import type { ToolDefinition } from '@opentabs-dev/plugin-sdk';
import { getApplicationForm } from './tools/get-application-form.js';
import { fillApplication } from './tools/fill-application.js';
import { attachFile } from './tools/attach-file.js';

class GreenhousePlugin extends OpenTabsPlugin {
  readonly name = 'greenhouse';
  readonly description = 'Read and fill Greenhouse job application forms. Never submits.';
  override readonly displayName = 'Greenhouse Apply';
  readonly urlPatterns = ['*://*.greenhouse.io/*'];
  readonly tools: ToolDefinition[] = [getApplicationForm, fillApplication, attachFile];

  // Public job pages need no login; the plugin is ready on any Greenhouse page.
  async isReady(): Promise<boolean> {
    return typeof document !== 'undefined';
  }
}

export default new GreenhousePlugin();
