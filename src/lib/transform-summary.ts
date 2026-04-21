/**
 * Transform GraphQL feedback data into unified FeedbackItem format.
 */

import type { ReviewState } from "./types.js";
import {
  formatLocation,
  reactionToStatus,
  type FeedbackItem,
  type FeedbackResponse,
} from "./summary-types.js";
import { isIgnoredAuthor } from "./github-environment.js";

// =============================================================================
// GraphQL Node Types
// =============================================================================

interface ReactionGroup {
  content: string;
  viewerHasReacted: boolean;
}

export interface SummaryReviewNode {
  databaseId: number;
  author: { login: string } | null; // null for deleted users (ghost)
  state: ReviewState;
  body: string;
  submittedAt: string;
  isMinimized: boolean;
  reactionGroups: ReactionGroup[];
}

export interface SummaryCommentNode {
  databaseId: number;
  author: { login: string } | null; // null for deleted users (ghost)
  body: string;
  createdAt: string;
  isMinimized: boolean;
  reactionGroups: ReactionGroup[];
}

interface SummaryThreadCommentNode {
  databaseId: number;
  author: { login: string } | null; // null for deleted users (ghost)
  body: string;
  path: string | null;
  line: number | null;
  createdAt: string;
  isMinimized: boolean;
  reactionGroups: ReactionGroup[];
}

export interface SummaryThreadNode {
  isResolved: boolean;
  isOutdated: boolean;
  comments: { nodes: SummaryThreadCommentNode[] };
}

// =============================================================================
// Transform Functions
// =============================================================================

export function transformReviews(nodes: SummaryReviewNode[], hideHidden: boolean): FeedbackItem[] {
  return nodes
    .filter((r) => !hideHidden || !r.isMinimized)
    .filter((r) => r.body && r.body.trim().length > 0)
    .filter((r) => !r.author || !isIgnoredAuthor(r.author.login))
    .map((r) => ({
      id: r.databaseId,
      timestamp: r.submittedAt,
      status: reactionToStatus(r.reactionGroups, r.isMinimized),
      author: r.author?.login ?? "ghost",
      location: "",
      body: r.body,
      responses: [], // Reviews don't have inline responses
    }));
}

export function transformComments(
  nodes: SummaryCommentNode[],
  hideHidden: boolean,
): FeedbackItem[] {
  return nodes
    .filter((c) => !hideHidden || !c.isMinimized)
    .filter((c) => c.body && c.body.trim().length > 0)
    .filter((c) => !c.author || !isIgnoredAuthor(c.author.login))
    .map((c) => ({
      id: c.databaseId,
      timestamp: c.createdAt,
      status: reactionToStatus(c.reactionGroups, c.isMinimized),
      author: c.author?.login ?? "ghost",
      location: "",
      body: c.body,
      responses: [], // Issue comments don't have threaded responses
    }));
}

export function transformThreads(
  nodes: SummaryThreadNode[],
  hideHidden: boolean,
  hideResolved: boolean,
): FeedbackItem[] {
  const results: FeedbackItem[] = [];

  for (const t of nodes) {
    if (hideResolved && t.isResolved) {
      continue;
    }

    const visibleComments = t.comments.nodes
      .filter((c) => !hideHidden || !c.isMinimized)
      .filter((c) => !c.author || !isIgnoredAuthor(c.author.login));

    const first = visibleComments[0];
    if (!first) {
      continue;
    }

    // First comment is the original feedback
    // Subsequent comments are responses
    const responses: FeedbackResponse[] = visibleComments.slice(1).map((c) => ({
      author: c.author?.login ?? "ghost",
      timestamp: c.createdAt,
      body: c.body,
    }));

    // Combine reactions from all comments in thread for status
    const allReactions = visibleComments.flatMap((c) => c.reactionGroups);

    results.push({
      id: first.databaseId,
      timestamp: first.createdAt,
      status: reactionToStatus(allReactions, t.isResolved),
      author: first.author?.login ?? "ghost",
      location: formatLocation(first.path, first.line),
      body: first.body,
      responses,
    });
  }

  return results;
}
