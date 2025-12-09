/**
 * Transform functions for summary feedback data.
 */

import type {
  ReviewSummary,
  ThreadSummary,
  CommentSummary,
  ReviewState,
} from "./types.js";
import { isIgnoredAuthor } from "./github-environment.js";

// =============================================================================
// GraphQL Node Types
// =============================================================================

export type SummaryReviewNode = {
  databaseId: number;
  author: { login: string };
  state: ReviewState;
  body: string;
  submittedAt: string;
  isMinimized: boolean;
};

export type SummaryCommentNode = {
  databaseId: number;
  author: { login: string };
  body: string;
  createdAt: string;
  isMinimized: boolean;
};

type SummaryThreadCommentNode = {
  databaseId: number;
  author: { login: string };
  body: string;
  path: string | null;
  line: number | null;
  createdAt: string;
  isMinimized: boolean;
};

export type SummaryThreadNode = {
  isResolved: boolean;
  isOutdated: boolean;
  comments: { nodes: SummaryThreadCommentNode[] };
};

// =============================================================================
// Transform Functions
// =============================================================================

export function transformSummaryReviews(
  nodes: SummaryReviewNode[],
  hideHidden: boolean,
): ReviewSummary[] {
  return nodes
    .filter((r) => !hideHidden || !r.isMinimized)
    .filter((r) => r.body && r.body.trim().length > 0)
    .filter((r) => !isIgnoredAuthor(r.author.login))
    .map((r) => ({
      id: r.databaseId,
      author: r.author.login,
      state: r.state,
      body: r.body,
      submittedAt: r.submittedAt,
      isResolved: r.isMinimized,
    }));
}

export function transformSummaryThreads(
  nodes: SummaryThreadNode[],
  hideHidden: boolean,
  hideResolved: boolean,
): ThreadSummary[] {
  const results: ThreadSummary[] = [];

  for (const t of nodes) {
    if (hideResolved && t.isResolved) continue;

    const visibleComments = t.comments.nodes
      .filter((c) => !hideHidden || !c.isMinimized)
      .filter((c) => !isIgnoredAuthor(c.author.login));

    const first = visibleComments[0];
    if (!first) continue;

    results.push({
      id: first.databaseId,
      path: first.path,
      line: first.line,
      isResolved: t.isResolved,
      isOutdated: t.isOutdated,
      comments: visibleComments.map((c) => ({
        id: c.databaseId,
        author: c.author.login,
        body: c.body,
        createdAt: c.createdAt,
      })),
    });
  }

  return results;
}

export function transformSummaryComments(
  nodes: SummaryCommentNode[],
  hideHidden: boolean,
): CommentSummary[] {
  return nodes
    .filter((c) => !hideHidden || !c.isMinimized)
    .filter((c) => !isIgnoredAuthor(c.author.login))
    .map((c) => ({
      id: c.databaseId,
      author: c.author.login,
      body: c.body,
      createdAt: c.createdAt,
    }));
}
