/**
 * Auto-detect feedback item type (thread, comment, or review).
 *
 * Tries each type in order: thread → comment → review.
 * Returns unified item info with node_id for mutations.
 */

import type { PullRequestReviewComment, IssueComment } from "./types.js";
import { ghJson, isNotFoundError } from "./github-cli.js";
import { getThreadForComment } from "./fetch-thread.js";
import { exitWithMessage } from "./git-helpers.js";
import { tryDetectReview } from "./detect-review.js";

type ItemType = "thread" | "comment" | "review";

/** Info about a sibling thread under the same review */
export type SiblingThread = {
  /** Thread's GraphQL ID */
  id: string;
  /** Comment database ID (for display) */
  commentId: number;
  /** Whether this thread is resolved */
  isResolved: boolean;
  /** File path (for location display) */
  path: string | null;
  /** Line number (for location display) */
  line: number | null;
};

export type DetectedItem = {
  type: ItemType;
  id: number;
  nodeId: string;
  author: string;
  /** For threads: the thread's GraphQL ID (for resolve/unresolve) */
  threadId?: string;
  /** For threads: whether already resolved */
  isResolved?: boolean;
  /** PR number the item belongs to */
  prNumber: number;
  /** File path (for threads) */
  path?: string | null;
  /** Line number (for threads) */
  line?: number | null;
  /** For reviews: all sibling threads under this review */
  siblingThreads?: SiblingThread[];
};

function tryDetectThread(
  owner: string,
  repo: string,
  itemId: number,
): DetectedItem | undefined {
  try {
    const comment = ghJson<PullRequestReviewComment>(
      "api",
      `repos/${owner}/${repo}/pulls/comments/${itemId}`,
    );

    const { prNumber, thread } = getThreadForComment(
      owner,
      repo,
      itemId,
      comment,
    );

    return {
      type: "thread",
      id: itemId,
      nodeId: comment.node_id,
      author: comment.user?.login ?? "ghost",
      threadId: thread.id,
      isResolved: thread.isResolved,
      prNumber,
      path: thread.path,
      line: thread.line,
    };
  } catch (error) {
    if (isNotFoundError(error)) return undefined;
    throw error;
  }
}

function tryDetectComment(
  owner: string,
  repo: string,
  itemId: number,
): DetectedItem | undefined {
  try {
    const comment = ghJson<IssueComment>(
      "api",
      `repos/${owner}/${repo}/issues/comments/${itemId}`,
    );

    const issueUrl = new URL(comment.issue_url);
    const prMatch = issueUrl.pathname.match(/\/issues\/(\d+)$/u);
    if (!prMatch?.[1]) {
      return undefined;
    }
    const prNumber = Number.parseInt(prMatch[1]);

    return {
      type: "comment",
      id: itemId,
      nodeId: comment.node_id,
      author: comment.user?.login ?? "ghost",
      prNumber,
    };
  } catch (error) {
    if (isNotFoundError(error)) return undefined;
    throw error;
  }
}

export function detectItemType(
  owner: string,
  repo: string,
  itemId: number,
): DetectedItem {
  // Try thread first (most common for PR feedback)
  const thread = tryDetectThread(owner, repo, itemId);
  if (thread) return thread;

  // Try issue comment
  const comment = tryDetectComment(owner, repo, itemId);
  if (comment) return comment;

  // Try review
  const review = tryDetectReview(owner, repo, itemId);
  if (review) return review;

  exitWithMessage(
    `Error: Could not find item #${itemId}. Ensure you're on the correct branch for this PR. ` +
      `Note: For reviews, only the 20 most recent PRs are searched.`,
  );
}
