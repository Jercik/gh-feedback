/**
 * GitHub backend: thin wrapper over the existing gh + GraphQL code.
 * Behavior is unchanged from before the provider seam existed. The underlying
 * functions are synchronous, so methods return resolved promises directly.
 */

import type { DetectedItem } from "./detect-item-type.js";
import type { ItemDetail } from "./fetch-item-detail.js";
import type { FeedbackSummary } from "./summary-types.js";
import type { ReactionContent } from "./types.js";
import type {
  CapabilityResult,
  FeedbackBackend,
  ItemStatus,
  ReplyResult,
  SummaryOptions,
} from "./feedback-backend.js";
import { detectItemType } from "./detect-item-type.js";
import { fetchItemDetail } from "./fetch-item-detail.js";
import { fetchSummary } from "./fetch-summary.js";
import { getItemStatus } from "./fetch-item-status.js";
import { addReactionToItem, removeViewerReactions } from "./react-item.js";
import { replyToItem } from "./reply-item.js";
import { resolveItem, unresolveItem } from "./resolve-item.js";

export function createGithubBackend(owner: string, repo: string): FeedbackBackend {
  return {
    provider: "github",

    fetchSummary(prNumber: number, options: SummaryOptions): Promise<FeedbackSummary> {
      return Promise.resolve(fetchSummary(owner, repo, prNumber, options));
    },

    fetchItemDetail(itemId: number): Promise<ItemDetail> {
      return Promise.resolve(fetchItemDetail(owner, repo, itemId));
    },

    detectItem(itemId: number): Promise<DetectedItem> {
      return Promise.resolve(detectItemType(owner, repo, itemId));
    },

    getItemStatus(item: DetectedItem): Promise<ItemStatus> {
      return Promise.resolve(getItemStatus(item));
    },

    reply(item: DetectedItem, message: string): Promise<ReplyResult> {
      return Promise.resolve(replyToItem(item, message));
    },

    addReaction(item: DetectedItem, reaction: ReactionContent): Promise<void> {
      addReactionToItem(item, reaction);
      return Promise.resolve();
    },

    removeReactions(
      item: DetectedItem,
      viewerReactions: ReactionContent[],
      toRemove: ReactionContent[],
    ): Promise<void> {
      removeViewerReactions(item, viewerReactions, toRemove);
      return Promise.resolve();
    },

    resolve(item: DetectedItem): Promise<CapabilityResult> {
      const result = resolveItem(item);
      return Promise.resolve({ supported: true, applied: result.resolved });
    },

    unresolve(item: DetectedItem, isMinimized: boolean): Promise<CapabilityResult> {
      const result = unresolveItem(item, isMinimized);
      return Promise.resolve({ supported: true, applied: result.unresolved });
    },
  };
}
