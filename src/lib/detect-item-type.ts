/**
 * Auto-detect feedback item type (thread, comment, or review).
 *
 * Tries each type in order: thread → comment → review.
 * Returns unified item info with node_id for mutations.
 */

import type { PullRequestReviewComment, IssueComment } from "./types.js";
import { ghJson } from "./github-cli.js";
import { getThreadForComment } from "./fetch-thread.js";
import { exitWithMessage } from "./git-helpers.js";
import { getPullRequestNumber } from "./github-environment.js";

type ItemType = "thread" | "comment" | "review";

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
  } catch {
    return undefined;
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

    // Extract PR number from issue_url
    const issueUrl = new URL(comment.issue_url);
    const prMatch = issueUrl.pathname.match(/\/issues\/(\d+)$/u);
    const prNumber = prMatch?.[1] ? Number.parseInt(prMatch[1]) : 0;

    return {
      type: "comment",
      id: itemId,
      nodeId: comment.node_id,
      author: comment.user?.login ?? "ghost",
      prNumber,
    };
  } catch {
    return undefined;
  }
}

type ReviewResponse = {
  id: number;
  node_id: string;
  user: { login: string } | null; // null for deleted users (ghost)
  pull_request_url: string;
};

function tryDetectReview(
  owner: string,
  repo: string,
  itemId: number,
): DetectedItem | undefined {
  // Try current branch's PR first (most common case)
  let currentPrNumber: number | undefined;
  try {
    currentPrNumber = getPullRequestNumber();
  } catch {
    currentPrNumber = undefined;
  }

  if (currentPrNumber) {
    try {
      const review = ghJson<ReviewResponse>(
        "api",
        `repos/${owner}/${repo}/pulls/${currentPrNumber}/reviews/${itemId}`,
      );
      return {
        type: "review",
        id: itemId,
        nodeId: review.node_id,
        author: review.user?.login ?? "ghost",
        prNumber: currentPrNumber,
      };
    } catch {
      // Not in current PR, fall through to search
    }
  }

  // Fallback: search recent PRs (limited to 20 - older reviews may not be found)
  try {
    const prs = ghJson<Array<{ number: number }>>(
      "api",
      `repos/${owner}/${repo}/pulls?state=all&per_page=20`,
    );

    for (const pr of prs) {
      // Skip current PR since we already checked it
      if (pr.number === currentPrNumber) continue;
      try {
        const review = ghJson<ReviewResponse>(
          "api",
          `repos/${owner}/${repo}/pulls/${pr.number}/reviews/${itemId}`,
        );
        return {
          type: "review",
          id: itemId,
          nodeId: review.node_id,
          author: review.user?.login ?? "ghost",
          prNumber: pr.number,
        };
      } catch {
        // Not found in this PR, continue
      }
    }
    return undefined;
  } catch {
    return undefined;
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
    `Error: Could not find item #${itemId}. Ensure you're on the correct branch for this PR.`,
  );
}
