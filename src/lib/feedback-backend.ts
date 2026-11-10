import type { ItemDetail } from "./fetch-item-detail.js";
import type { DoneStatus } from "./feedback-types.js";
import type { ServiceFinding } from "./review-service-finding.js";
import type { OwnReply } from "./select-reusable-reply.js";
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
  doneStatus: DoneStatus | undefined;
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

export type FeedbackOutcome = DoneStatus;

export interface FeedbackBackend {
  // Resolves undefined for anything that is not an inline comment posted by the review service.
  readServiceFinding: (item: FeedbackItemRef) => Promise<ServiceFinding | undefined>;
  listOwnReplies: (item: FeedbackItemRef) => Promise<OwnReply[]>;

  fetchSummary: (options: SummaryOptions) => Promise<FeedbackSummary>;
  fetchItemDetail: (itemId: number) => Promise<ItemDetail>;
  detectItem: (itemId: number) => Promise<FeedbackItemRef>;
  getItemStatus: (item: FeedbackItemRef) => Promise<ItemStatus>;

  reply: (item: FeedbackItemRef, message: string) => Promise<ReplyResult>;
  // Adding a reaction the viewer already has, or removing one they lack, succeeds unchanged.
  addReaction: (item: FeedbackItemRef, reaction: ReactionContent) => Promise<void>;
  removeReactions: (item: FeedbackItemRef, reactions: ReactionContent[]) => Promise<void>;

  complete: (item: FeedbackItemRef, outcome: FeedbackOutcome) => Promise<CapabilityResult>;
  unresolve: (item: FeedbackItemRef) => Promise<CapabilityResult>;
}
