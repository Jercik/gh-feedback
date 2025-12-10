/**
 * Review detection logic.
 *
 * Handles the complexity of reviews with empty bodies that contain thread comments.
 * Extracted from detect-item-type.ts to reduce complexity.
 */

import type { DetectedItem } from "./detect-item-type.js";
import { ghJson, isNotFoundError } from "./github-cli.js";
import { getThreadForComment } from "./fetch-thread.js";
import { getPullRequestNumber } from "./github-environment.js";

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
};

type ReviewTargetInfo = {
  nodeId: string;
  threadId?: string;
  isResolved?: boolean;
};

/**
 * Get the appropriate target info for reacting to a review.
 *
 * Reviews with empty bodies but with comments should target the first comment,
 * since that's what's visible in the GitHub UI. Empty-body reviews are just
 * containers and their reactions aren't visible.
 */
function getReviewTargetInfo(
  owner: string,
  repo: string,
  prNumber: number,
  review: ReviewResponse,
): ReviewTargetInfo {
  if (review.body.trim() !== "") {
    return { nodeId: review.node_id };
  }

  try {
    const comments = ghJson<ReviewCommentResponse[]>(
      "api",
      `repos/${owner}/${repo}/pulls/${prNumber}/reviews/${review.id}/comments?per_page=1`,
    );

    const firstComment = comments[0];
    if (firstComment) {
      const { thread } = getThreadForComment(owner, repo, firstComment.id);
      return {
        nodeId: firstComment.node_id,
        threadId: thread.id,
        isResolved: thread.isResolved,
      };
    }
  } catch {
    // Fall back to review node_id
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
