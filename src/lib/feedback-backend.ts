/**
 * Provider-neutral data layer seam.
 *
 * Both forges implement this interface; commands and the CLI talk only to it,
 * never to gh/GraphQL or fgj/REST directly. Items cross the seam as a neutral
 * `FeedbackItemRef` that carries only what commands need; each backend keeps
 * its provider-specific handle (GraphQL node/thread IDs, Forgejo item kind)
 * private and re-associates it by `id`.
 *
 * Capabilities that one forge lacks (thread resolve, comment hide) are modeled
 * as explicit results so callers can DEGRADE gracefully instead of crashing.
 */

import type { ItemDetail } from "./fetch-item-detail.js";
import type { FeedbackSummary } from "./summary-types.js";
import type { ReactionContent } from "./types.js";

/**
 * Forge-neutral reference to a feedback item. Holds only the fields commands
 * read; backend-internal identifiers (node IDs, thread IDs, review kinds) stay
 * private to each backend and are looked up by `id`.
 */
export interface FeedbackItemRef {
  type: "thread" | "comment" | "review";
  id: number;
  author: string;
  prNumber: number;
  path: string | null;
  line: number | null;
}

export interface SummaryOptions {
  hideHidden?: boolean;
  hideResolved?: boolean;
}

export interface ItemStatus {
  doneStatus: "agreed" | "disagreed" | "acknowledged" | undefined;
  viewerReactions: ReactionContent[];
  isMinimized: boolean;
  /** Thread/PR-level resolved state; always false where the forge lacks resolve. */
  isResolved: boolean;
}

export interface ReplyResult {
  id: number;
  url: string;
}

/**
 * Outcome of a resolve/hide attempt. `supported: false` means the forge has no
 * equivalent API (Forgejo lacks thread RESOLVE and comment MINIMIZE), so the
 * caller should treat the workflow marker as the reaction alone.
 */
export type CapabilityResult =
  | { supported: true; applied: boolean }
  | { supported: false; reason: string };

export interface FeedbackBackend {
  readonly provider: "github" | "forgejo";

  fetchSummary: (prNumber: number, options: SummaryOptions) => Promise<FeedbackSummary>;
  fetchItemDetail: (itemId: number) => Promise<ItemDetail>;
  detectItem: (itemId: number) => Promise<FeedbackItemRef>;
  getItemStatus: (item: FeedbackItemRef) => Promise<ItemStatus>;

  reply: (item: FeedbackItemRef, message: string) => Promise<ReplyResult>;
  addReaction: (item: FeedbackItemRef, reaction: ReactionContent) => Promise<void>;
  removeReactions: (
    item: FeedbackItemRef,
    viewerReactions: ReactionContent[],
    toRemove: ReactionContent[],
  ) => Promise<void>;

  /** Mark an item done (resolve thread / hide comment). May be unsupported. */
  resolve: (item: FeedbackItemRef) => Promise<CapabilityResult>;
  /** Re-open an item. `isMinimized` only matters for the GitHub hide axis. */
  unresolve: (item: FeedbackItemRef, isMinimized: boolean) => Promise<CapabilityResult>;

  /**
   * Guard a destructive resolve that would hide a review's still-unresolved
   * sibling threads. Exits with an error when blocked. No-op where the forge
   * has no review-container/sibling-thread concept.
   */
  blockIfUnresolvedSiblings: (item: FeedbackItemRef, actionVerb: string) => Promise<void>;
}
