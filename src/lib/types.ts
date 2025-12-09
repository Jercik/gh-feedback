// =============================================================================
// Repository Types
// =============================================================================

export type RepoInfo = {
  readonly owner: string;
  readonly repo: string;
  readonly ownerRepo: string;
};

// =============================================================================
// Reaction Types
// =============================================================================

export type ReactionContent =
  | "+1"
  | "-1"
  | "laugh"
  | "confused"
  | "heart"
  | "hooray"
  | "rocket"
  | "eyes";

export type ReactionGroupNode = {
  readonly content: string;
  readonly users: {
    readonly totalCount: number;
    readonly nodes: ReadonlyArray<{ readonly login: string }>;
  };
  readonly viewerHasReacted: boolean;
};

export type Reaction = {
  readonly content: string;
  readonly count: number;
  readonly viewerHasReacted: boolean;
  readonly users: readonly string[];
};

export type ReactionSummary = {
  readonly content: ReactionContent;
  readonly count: number;
};

// =============================================================================
// Comment Classification
// =============================================================================

export type Classifier =
  | "SPAM"
  | "ABUSE"
  | "OFF_TOPIC"
  | "OUTDATED"
  | "DUPLICATE"
  | "RESOLVED";

// =============================================================================
// Issue Comment Types (Conversation Tab)
// =============================================================================

export type IssueComment = {
  readonly id: number;
  readonly node_id: string;
  readonly body: string;
  readonly user: { readonly login: string };
  readonly issue_url: string;
  readonly html_url: string;
  readonly created_at: string;
  readonly updated_at: string;
  readonly reactions?: {
    readonly total_count: number;
    readonly "+1": number;
    readonly "-1": number;
    readonly laugh: number;
    readonly confused: number;
    readonly heart: number;
    readonly hooray: number;
    readonly rocket: number;
    readonly eyes: number;
  };
};

// =============================================================================
// Review Comment Types (Files Changed Tab)
// =============================================================================

export type PullRequestReviewComment = {
  readonly id: number;
  readonly node_id: string;
  readonly body: string;
  readonly user: { readonly login: string };
  readonly html_url: string;
  readonly pull_request_url: string;
  readonly path: string;
  readonly line: number | null;
  readonly created_at: string;
  readonly updated_at: string;
};

// =============================================================================
// Review Summary Types
// =============================================================================

export type ReviewState =
  | "APPROVED"
  | "CHANGES_REQUESTED"
  | "COMMENTED"
  | "DISMISSED"
  | "PENDING";

// =============================================================================
// Unified Feedback Types (for gh-feedback status command)
// =============================================================================

// Metadata-only types for concise gh-feedback status output
export type ReviewMeta = {
  readonly id: number;
  readonly author: string;
  readonly state: ReviewState;
  readonly url: string;
  readonly submittedAt: string;
  readonly viewerReactions: readonly string[];
  readonly isMinimized: boolean;
  readonly minimizedReason: string | null;
};

/** Thread metadata (PullRequestReviewComment threads - line comments in Files Changed tab) */
export type ThreadMeta = {
  readonly id: number;
  readonly path: string | null;
  readonly line: number | null;
  readonly author: string;
  readonly createdAt: string;
  readonly replyCount: number;
  readonly viewerReactions: readonly string[];
  readonly isOutdated: boolean;
  readonly isResolved: boolean;
};

/** Comment metadata (IssueComment - general comments in Conversation tab) */
export type CommentMeta = {
  readonly id: number;
  readonly author: string;
  readonly url: string;
  readonly createdAt: string;
  readonly viewerReactions: readonly string[];
  readonly isMinimized: boolean;
};

export type PullRequestFeedback = {
  readonly number: number;
  readonly url: string;
  readonly title: string;
  readonly reviews: ReviewMeta[];
  readonly threads: ThreadMeta[];
  readonly comments: CommentMeta[];
};

export type ThreadInfo = {
  readonly id: string;
  readonly isResolved: boolean;
  readonly path: string;
  readonly line: number | null;
  readonly comments: ReadonlyArray<{
    readonly databaseId: number;
    readonly author: { readonly login: string };
    readonly body: string;
  }>;
};

export type CommentInfo = {
  readonly id: number;
  readonly pullRequestNumber: number;
  readonly path: string | null;
  readonly line: number | null;
  readonly body: string;
  readonly author: string;
  readonly inReplyToId: number | null;
};

// =============================================================================
// GraphQL Pagination Types
// =============================================================================

export type PageInfo = {
  readonly endCursor: string | null;
  readonly hasNextPage: boolean;
};

// =============================================================================
// Summary Types (for LLM context - includes full body content)
// =============================================================================

/** Review with full body content for summary output */
export type ReviewSummary = {
  readonly id: number;
  readonly author: string;
  readonly state: ReviewState;
  readonly body: string;
  readonly submittedAt: string;
  readonly isResolved: boolean;
};

/** Thread comment with full body for summary output */
type ThreadCommentSummary = {
  readonly id: number;
  readonly author: string;
  readonly body: string;
  readonly createdAt: string;
};

/** Thread with full conversation for summary output */
export type ThreadSummary = {
  readonly id: number;
  readonly path: string | null;
  readonly line: number | null;
  readonly isResolved: boolean;
  readonly isOutdated: boolean;
  readonly comments: readonly ThreadCommentSummary[];
};

/** Issue comment with full body for summary output */
export type CommentSummary = {
  readonly id: number;
  readonly author: string;
  readonly body: string;
  readonly createdAt: string;
};

/** Complete PR feedback summary for LLM context */
export type PullRequestSummary = {
  readonly number: number;
  readonly url: string;
  readonly title: string;
  readonly reviews: readonly ReviewSummary[];
  readonly threads: readonly ThreadSummary[];
  readonly comments: readonly CommentSummary[];
};
