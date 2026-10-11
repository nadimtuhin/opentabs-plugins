import './jitless.js';
import { OpenTabsPlugin } from '@opentabs-dev/plugin-sdk';
import type { ToolDefinition } from '@opentabs-dev/plugin-sdk';
import { getProfile, setProfileText, setSkills, setCategories } from './tools/profile.js';

class UpworkPlugin extends OpenTabsPlugin {
  readonly name = 'upwork';
  readonly description =
    'Read and edit the Upwork freelancer profile (title, overview, skills, categories). Cannot change rate, visibility, Connects or the Open for work badge.';
  override readonly displayName = 'Upwork';
  readonly urlPatterns = ['*://*.upwork.com/*'];
  readonly tools: ToolDefinition[] = [getProfile, setProfileText, setSkills, setCategories];

  // ponytail: any non-login Upwork page counts as ready; tools fail with a clear error if logged out.
  async isReady(): Promise<boolean> {
    return typeof document !== 'undefined' && !location.pathname.includes('/login');
  }
}

export default new UpworkPlugin();
