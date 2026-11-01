import type { ItemDetail } from "./fetch-item-detail.js";
import type { FeedbackSummary } from "./summary-types.js";
import type { ReactionContent } from "./types.js";

export interface FeedbackItemRef {
  type: "thread" | "comment" | "review";
  id: number;
  author: string;
  prNumber: number;
  path: string | null;
  line: number | null;
}

export interface SummaryOptions {
  hideResolved?: boolean;
}

export interface ItemStatus {
  doneStatus: "agreed" | "disagreed" | "acknowledged" | undefined;
  viewerReactions: ReactionContent[];
  isResolved: boolean;
  viewerMayReopen: boolean;
}

export interface ReplyResult {
  id: number;
  url: string;
}

export type CapabilityResult =
  | { supported: true; applied: true }
  | { supported: true; applied: false; reason: string }
  | { supported: false; reason: string };

export type FeedbackOutcome = "agreed" | "disagreed" | "acknowledged";

export interface FeedbackBackend {
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

  complete: (item: FeedbackItemRef, outcome: FeedbackOutcome) => Promise<CapabilityResult>;
  unresolve: (item: FeedbackItemRef) => Promise<CapabilityResult>;
}
