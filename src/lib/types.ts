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
// GraphQL Pagination Types
// =============================================================================

export type PageInfo = {
  readonly endCursor: string | null;
  readonly hasNextPage: boolean;
};
