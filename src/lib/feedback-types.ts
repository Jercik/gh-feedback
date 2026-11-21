export type FindingStatus =
  | "pending" // Needs attention
  | "in-progress" // Work started, or the recorded state is inconsistent - treat carefully
  | "awaiting-reply" // Asked a question - blocked on reviewer
  | "agreed" // Fixed
  | "disagreed" // Won't fix
  | "acknowledged" // Noted, no action
  | "dismissed"; // Rejected until reopened and recorded with the review service

export const doneStatuses = [
  "agreed",
  "disagreed",
  "acknowledged",
  "dismissed",
] as const satisfies readonly FindingStatus[];

export type DoneStatus = (typeof doneStatuses)[number];

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

export interface UnfetchedFindingState {
  viewerReactions: null;
  status: null;
  conflictingFinalReactions: false;
}

interface NullableFindingState {
  viewerReactions: string[] | null;
  status: FindingStatus | null;
  conflictingFinalReactions: boolean;
}

export interface ReviewFields {
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

export type ReviewRecord = ReviewFields & NullableFindingState;

export interface InlineCommentFields {
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

export type CommentRecord = InlineCommentFields & NullableFindingState;

export interface Conversation<Comment> {
  reviewId: number;
  path: string;
  side: Side;
  displayLine: number;
  anchorId: number;
  // Not folded into its comments' status, which reflects their viewerReactions alone.
  resolver: UserRef | null;
  comments: Comment[];
}

export type ConversationRecord = Conversation<CommentRecord>;

export interface IssueCommentFields {
  id: number;
  user: UserRef;
  body: string;
  createdAt: string | null;
  updatedAt: string | null;
  htmlUrl: string | null;
}

export type ClassifiedIssueComment = IssueCommentFields &
  ({ kind: "finding"; replyTo: null } | { kind: "reply"; replyTo: number });

export type IssueCommentRecord = IssueCommentFields &
  (
    | ({ kind: "finding"; replyTo: null } & FindingState)
    | ({ kind: "reply"; replyTo: number } & UnfetchedFindingState)
  );

interface PullRequestComments<Review, InlineComment, IssueComment> {
  reviews: {
    totalCount: number;
    distinctCount: number;
    countGap: number;
    records: Review[];
  };
  issueComments: { totalCount: number; records: IssueComment[] };
  conversations: Conversation<InlineComment>[];
  unpublishedInlineComments: InlineComment[];
}

export type SweptComments = PullRequestComments<
  ReviewFields,
  InlineCommentFields,
  ClassifiedIssueComment
>;

export type PassSnapshot = PullRequestComments<ReviewRecord, CommentRecord, IssueCommentRecord>;
