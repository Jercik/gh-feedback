/**
 * Review detection logic.
 *
 * Handles the complexity of reviews with empty bodies that contain thread comments.
 * Extracted from detect-item-type.ts to reduce complexity.
 */

import type { DetectedItem, SiblingThread } from "./detect-item-type.js";
import { ghJson, isNotFoundError } from "./github-cli.js";
import { getThreadForComment } from "./fetch-thread.js";
import { getPullRequestNumber } from "./github-environment.js";
import { WARNING } from "./tty-output.js";

type ReviewResponse = {
  id: number;
  node_id: string;
  body: string;
  user: { login: string } | null;
  pull_request_url: string;
};

type ReviewCommentResponse = {
  id: number;
  node_id: string;
  pull_request_url: string;
};

type ReviewTargetInfo = {
  nodeId: string;
  threadId?: string;
  isResolved?: boolean;
  /** All sibling threads under this review */
  siblingThreads?: SiblingThread[];
};

/**
 * Get the appropriate target info for reacting to a review.
 *
 * Reviews with empty bodies but with comments should target the first comment,
 * since that's what's visible in the GitHub UI. Empty-body reviews are just
 * containers and their reactions aren't visible.
 *
 * Also tracks ALL sibling threads under this review to prevent hiding
 * unresolved feedback when ACK-ing.
 */
function getReviewTargetInfo(
  owner: string,
  repo: string,
  prNumber: number,
  review: ReviewResponse,
): ReviewTargetInfo {
  const hasBody = review.body.trim() !== "";

  try {
    // Fetch ALL comments under this review to track sibling threads
    const comments = ghJson<ReviewCommentResponse[]>(
      "api",
      `repos/${owner}/${repo}/pulls/${prNumber}/reviews/${review.id}/comments?per_page=100`,
    );

    // Warn if we may have hit the pagination limit
    if (comments.length === 100) {
      console.error(
        `${WARNING} Review #${review.id} has 100 comments (API page limit). If there are more, some sibling threads may not be tracked.`,
      );
    }

    // No comments - just return the review node_id
    if (comments.length === 0) {
      return { nodeId: review.node_id };
    }

    // Collect thread info for all comments
    const siblingThreads: SiblingThread[] = [];
    const seenThreadIds = new Set<string>();

    for (const comment of comments) {
      // Pass comment data to avoid extra API call per comment (N+1 optimization)
      const { thread } = getThreadForComment(owner, repo, comment.id, comment);

      // Skip duplicate threads (multiple comments in same thread)
      if (seenThreadIds.has(thread.id)) {
        continue;
      }
      seenThreadIds.add(thread.id);

      siblingThreads.push({
        id: thread.id,
        commentId: comment.id,
        isResolved: thread.isResolved,
        path: thread.path,
        line: thread.line,
      });
    }

    // Reviews WITH body: target the review itself, but track sibling threads
    if (hasBody) {
      return {
        nodeId: review.node_id,
        siblingThreads: siblingThreads.length > 0 ? siblingThreads : undefined,
      };
    }

    // Reviews WITHOUT body (containers): target the first comment's thread
    const firstComment = comments[0];
    const firstThread = siblingThreads[0];
    if (firstComment && firstThread) {
      return {
        nodeId: firstComment.node_id,
        threadId: firstThread.id,
        isResolved: firstThread.isResolved,
        siblingThreads: siblingThreads.length > 1 ? siblingThreads : undefined,
      };
    }
  } catch (error) {
    // Log errors to help debug sibling thread detection issues
    const message = error instanceof Error ? error.message : String(error);
    if (!message.includes("Not Found")) {
      console.error(`Warning: Failed to fetch review comments: ${message}`);
    }
  }

  return { nodeId: review.node_id };
}

function buildReviewItem(
  itemId: number,
  prNumber: number,
  review: ReviewResponse,
  target: ReviewTargetInfo,
): DetectedItem {
  return {
    type: "review",
    id: itemId,
    nodeId: target.nodeId,
    author: review.user?.login ?? "ghost",
    prNumber,
    threadId: target.threadId,
    isResolved: target.isResolved,
    siblingThreads: target.siblingThreads,
  };
}

export function tryDetectReview(
  owner: string,
  repo: string,
  itemId: number,
): DetectedItem | undefined {
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
      const target = getReviewTargetInfo(owner, repo, currentPrNumber, review);
      return buildReviewItem(itemId, currentPrNumber, review, target);
    } catch (error) {
      if (!isNotFoundError(error)) throw error;
    }
  }

  console.error(
    `Note: Review #${itemId} not in current PR, searching recent PRs (this may be slow)...`,
  );

  try {
    const prs = ghJson<Array<{ number: number }>>(
      "api",
      `repos/${owner}/${repo}/pulls?state=all&per_page=20`,
    );

    for (const pr of prs) {
      if (pr.number === currentPrNumber) continue;
      try {
        const review = ghJson<ReviewResponse>(
          "api",
          `repos/${owner}/${repo}/pulls/${pr.number}/reviews/${itemId}`,
        );
        const target = getReviewTargetInfo(owner, repo, pr.number, review);
        return buildReviewItem(itemId, pr.number, review, target);
      } catch (error) {
        if (!isNotFoundError(error)) throw error;
      }
    }
    return undefined;
  } catch (error) {
    if (isNotFoundError(error)) return undefined;
    throw error;
  }
}
