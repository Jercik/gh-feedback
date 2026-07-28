/**
 * GitHub backend: thin wrapper over the existing gh + GraphQL code.
 * Behavior is unchanged from before the provider seam existed. The underlying
 * functions are synchronous, so methods return resolved promises directly.
 *
 * `detectItem` returns the neutral ref but caches the full `DetectedItem` (with
 * its GraphQL node/thread IDs) by `id`, so later mutations re-use it without a
 * second detection round-trip.
 */

import type { DetectedItem } from "./detect-item-type.js";
import type { ItemDetail } from "./fetch-item-detail.js";
import type { FeedbackSummary } from "./summary-types.js";
import type { ReactionContent } from "./types.js";
import type {
  CapabilityResult,
  FeedbackBackend,
  FeedbackItemRef,
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
import { blockIfUnresolvedSiblings as guardSiblingThreads } from "./check-sibling-threads.js";

function toRef(item: DetectedItem): FeedbackItemRef {
  return {
    type: item.type,
    id: item.id,
    author: item.author,
    prNumber: item.prNumber,
    path: item.path ?? null,
    line: item.line ?? null,
  };
}

export function createGithubBackend(owner: string, repo: string): FeedbackBackend {
  const cache = new Map<number, DetectedItem>();

  function rich(ref: FeedbackItemRef): DetectedItem {
    const cached = cache.get(ref.id);
    if (cached) {
      return cached;
    }
    const item = detectItemType(owner, repo, ref.id);
    cache.set(ref.id, item);
    return item;
  }

  return {
    provider: "github",

    fetchSummary(prNumber: number, options: SummaryOptions): Promise<FeedbackSummary> {
      return Promise.resolve(fetchSummary(owner, repo, prNumber, options));
    },

    fetchItemDetail(itemId: number): Promise<ItemDetail> {
      return Promise.resolve(fetchItemDetail(owner, repo, itemId));
    },

    detectItem(itemId: number): Promise<FeedbackItemRef> {
      const item = detectItemType(owner, repo, itemId);
      cache.set(itemId, item);
      return Promise.resolve(toRef(item));
    },

    getItemStatus(ref: FeedbackItemRef): Promise<ItemStatus> {
      const item = rich(ref);
      const status = getItemStatus(item);
      return Promise.resolve({ ...status, isResolved: item.isResolved ?? false });
    },

    reply(ref: FeedbackItemRef, message: string): Promise<ReplyResult> {
      return Promise.resolve(replyToItem(rich(ref), message));
    },

    addReaction(ref: FeedbackItemRef, reaction: ReactionContent): Promise<void> {
      addReactionToItem(rich(ref), reaction);
      return Promise.resolve();
    },

    removeReactions(
      ref: FeedbackItemRef,
      viewerReactions: ReactionContent[],
      toRemove: ReactionContent[],
    ): Promise<void> {
      removeViewerReactions(rich(ref), viewerReactions, toRemove);
      return Promise.resolve();
    },

    complete(ref: FeedbackItemRef, _outcome): Promise<CapabilityResult> {
      const result = resolveItem(rich(ref));
      return Promise.resolve({ supported: true, applied: result.resolved });
    },

    unresolve(ref: FeedbackItemRef, isMinimized: boolean): Promise<CapabilityResult> {
      const result = unresolveItem(rich(ref), isMinimized);
      return Promise.resolve({ supported: true, applied: result.unresolved });
    },

    blockIfUnresolvedSiblings(ref: FeedbackItemRef, actionVerb: string): Promise<void> {
      guardSiblingThreads(rich(ref), actionVerb);
      return Promise.resolve();
    },
  };
}
