/**
 * Provider-neutral data layer seam.
 *
 * Both forges implement this interface; commands and the CLI talk only to it,
 * never to gh/GraphQL or fgj/REST directly. The GitHub backend wraps the
 * existing gh + GraphQL code unchanged. The Forgejo backend uses REST /api/v1.
 *
 * Capabilities that one forge lacks (thread resolve, comment hide) are modeled
 * as explicit results so callers can DEGRADE gracefully instead of crashing.
 */

import type { DetectedItem } from "./detect-item-type.js";
import type { ItemDetail } from "./fetch-item-detail.js";
import type { FeedbackSummary } from "./summary-types.js";
import type { ReactionContent } from "./types.js";

export interface SummaryOptions {
  hideHidden?: boolean;
  hideResolved?: boolean;
}

export interface ItemStatus {
  doneStatus: "agreed" | "disagreed" | "acknowledged" | undefined;
  viewerReactions: ReactionContent[];
  isMinimized: boolean;
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

  fetchSummary(prNumber: number, options: SummaryOptions): Promise<FeedbackSummary>;
  fetchItemDetail(itemId: number): Promise<ItemDetail>;
  detectItem(itemId: number): Promise<DetectedItem>;
  getItemStatus(item: DetectedItem): Promise<ItemStatus>;

  reply(item: DetectedItem, message: string): Promise<ReplyResult>;
  addReaction(item: DetectedItem, reaction: ReactionContent): Promise<void>;
  removeReactions(
    item: DetectedItem,
    viewerReactions: ReactionContent[],
    toRemove: ReactionContent[],
  ): Promise<void>;

  /** Mark an item done (resolve thread / hide comment). May be unsupported. */
  resolve(item: DetectedItem): Promise<CapabilityResult>;
  /** Re-open an item. `isMinimized` only matters for the GitHub hide axis. */
  unresolve(item: DetectedItem, isMinimized: boolean): Promise<CapabilityResult>;
}
