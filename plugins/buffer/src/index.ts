import './jitless.js';
import { OpenTabsPlugin } from '@opentabs-dev/plugin-sdk';
import type { ToolDefinition } from '@opentabs-dev/plugin-sdk';
import { listDrafts } from './tools/list-drafts.js';
import { scheduleDrafts } from './tools/schedule-drafts.js';

// ponytail: covers only what Buffer's API/MCP can't do (turning timed drafts into scheduled posts).
// Creating and editing posts stays with the Buffer MCP. Add tools when a real gap shows up.
class BufferPlugin extends OpenTabsPlugin {
  readonly name = 'buffer';
  readonly description = 'Schedule Buffer drafts that already have a time. Never publishes now.';
  override readonly displayName = 'Buffer';
  readonly urlPatterns = ['*://publish.buffer.com/*'];
  readonly tools: ToolDefinition[] = [listDrafts, scheduleDrafts];

  async isReady(): Promise<boolean> {
    return typeof document !== 'undefined' && !!document.querySelector('[role=tab]');
  }
}

export default new BufferPlugin();
