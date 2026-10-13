import './jitless.js';
import { OpenTabsPlugin } from '@opentabs-dev/plugin-sdk';
import type { ToolDefinition } from '@opentabs-dev/plugin-sdk';
import { getApplyState, fillCoverLetter } from './tools/apply.js';
import { getProfileForm, fillProfileFields, saveProfile, pickOption, setYear, addSkill, removeSkill } from './tools/profile.js';

class ToptalPlugin extends OpenTabsPlugin {
  readonly name = 'toptal';
  readonly description =
    'Fill Toptal Talent Portal job applications (cover letter, terms). Edit profile sections. Never submits applications.';
  override readonly displayName = 'Toptal Apply';
  readonly urlPatterns = ['*://talent.toptal.com/*'];
  readonly tools: ToolDefinition[] = [getApplyState, fillCoverLetter, getProfileForm, fillProfileFields, saveProfile, pickOption, setYear, addSkill, removeSkill];

  async isReady(): Promise<boolean> {
    return typeof document !== 'undefined';
  }
}

export default new ToptalPlugin();
