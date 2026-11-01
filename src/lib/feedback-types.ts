export type FindingStatus =
  | "pending"
  | "in-progress"
  | "awaiting-reply"
  | "agreed"
  | "disagreed"
  | "acknowledged";

export type Side = "new" | "old" | "zero";

export interface UserRef {
  id: number | null;
  login: string | null;
}

export interface ReviewRecord {
  id: number;
  state: string;
  unpublished: boolean;
  user: UserRef;
  body: string;
  submittedAt: string | null;
  commitId: string | null;
  htmlUrl: string | null;
  backingCommentId: number | null;
  viewerReactions: string[] | null;
  status: FindingStatus | null;
  conflictingFinalReactions: boolean;
}

export interface CommentRecord {
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
  viewerReactions: string[] | null;
  status: FindingStatus | null;
  conflictingFinalReactions: boolean;
}

export interface ConversationRecord {
  reviewId: number;
  path: string;
  side: Side;
  displayLine: number;
  anchorId: number;
  resolver: UserRef | null;
  comments: CommentRecord[];
}

export interface IssueCommentRecord {
  viewerReactions: string[];
  status: FindingStatus;
  conflictingFinalReactions: boolean;
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
