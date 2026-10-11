import './jitless.js';
import { OpenTabsPlugin } from '@opentabs-dev/plugin-sdk';
import type { ToolDefinition } from '@opentabs-dev/plugin-sdk';
import { isAuthenticated, waitForAuth } from './facebook-api.js';
import { listFriendRequests } from './tools/list-friend-requests.js';
import { suggestTriage } from './tools/suggest-triage.js';
import { confirmRequest } from './tools/confirm-request.js';
import { deleteRequest } from './tools/delete-request.js';
import { batchTriage } from './tools/batch-triage.js';
import { getFriendsOverview } from './tools/get-friends-overview.js';

class FbFriendsManagerPlugin extends OpenTabsPlugin {
  readonly name = 'fb-friends-manager';
  readonly description =
    'Facebook friend requests and friends management with intelligent triage suggestions (accept vs delete).';
  override readonly displayName = 'Facebook Friends Manager';
  readonly urlPatterns = ['*://*.facebook.com/*'];
  override readonly homepage = 'https://www.facebook.com/friends/requests';

  readonly tools: ToolDefinition[] = [
    listFriendRequests,
    suggestTriage,
    confirmRequest,
    deleteRequest,
    batchTriage,
    getFriendsOverview,
  ];

  async isReady(): Promise<boolean> {
    if (typeof document !== 'undefined' && document.cookie.includes('c_user=')) {
      return true;
    }
    if (isAuthenticated()) {
      return true;
    }
    return waitForAuth();
  }
}

export default new FbFriendsManagerPlugin();
