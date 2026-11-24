import './jitless.js';
import type { ToolDefinition } from '@opentabs-dev/plugin-sdk';
import { OpenTabsPlugin } from '@opentabs-dev/plugin-sdk';
import { listApprovals } from './tools/list-approvals.js';
import { respondApproval } from './tools/respond-approval.js';

class MusePlugin extends OpenTabsPlugin {
  readonly name = 'muse';
  readonly description = 'List and answer muse.ai assistant approval cards (allow, always allow, deny).';
  override readonly displayName = 'Muse';
  readonly urlPatterns = ['*://muse.ai/*', '*://*.muse.ai/*'];
  readonly tools: ToolDefinition[] = [listApprovals, respondApproval];

  async isReady(): Promise<boolean> {
    return typeof document !== 'undefined' && document.readyState !== 'loading';
  }
}

export default new MusePlugin();
