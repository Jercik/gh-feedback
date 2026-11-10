export type FindingStatus =
  | "pending" // Needs attention
  | "in-progress" // Work started, or the recorded state is inconsistent - treat carefully
  | "awaiting-reply" // Asked a question - blocked on reviewer
  | "agreed" // Fixed
  | "disagreed" // Won't fix
  | "acknowledged" // Noted, no action
  | "dismissed"; // Rejected for good and recorded with the review service

export type DoneStatus = "agreed" | "disagreed" | "acknowledged" | "dismissed";

export type Side = "new" | "old" | "zero";

export interface UserRef {
  id: number | null;
  login: string | null;
}

export interface FindingState {
  viewerReactions: string[];
  status: FindingStatus;
  conflictingFinalReactions: boolean;
}

export interface NullableFindingState {
  viewerReactions: string[] | null;
  status: FindingStatus | null;
  conflictingFinalReactions: boolean;
}

export interface ReviewRecord extends NullableFindingState {
  id: number;
  state: string;
  unpublished: boolean;
  user: UserRef;
  body: string;
  submittedAt: string | null;
  commitId: string | null;
  htmlUrl: string | null;
  backingCommentId: number | null;
}

export interface CommentRecord extends NullableFindingState {
  id: number;
  kind: "finding" | "reply";
  replyTo: number | null;
  user: UserRef;
  body: string;
  createdAt: string | null;
  path: string;
  position: number;
  originalPosition: number;
  extraLinesCount: number;
  side: Side;
  displayLine: number;
  pullRequestReviewId: number;
  htmlUrl: string | null;
  resolver: UserRef | null;
}

export interface ConversationRecord {
  reviewId: number;
  path: string;
  side: Side;
  displayLine: number;
  anchorId: number;
  // Not folded into its comments' status, which reflects their viewerReactions alone.
  resolver: UserRef | null;
  comments: CommentRecord[];
}

export interface IssueCommentRecord extends FindingState {
  id: number;
  user: UserRef;
  body: string;
  createdAt: string | null;
  updatedAt: string | null;
  htmlUrl: string | null;
}

export interface PassSnapshot {
  reviews: {
    totalCount: number;
    distinctCount: number;
    countGap: number;
    records: ReviewRecord[];
  };
  issueComments: { totalCount: number; records: IssueCommentRecord[] };
  conversations: ConversationRecord[];
  unpublishedInlineComments: CommentRecord[];
}
