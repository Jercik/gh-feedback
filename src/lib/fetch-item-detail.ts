/**
 * Item detail fetching for read command.
 * Re-exports from specialized modules for backward compatibility.
 */

import type { Reaction, PullRequestReviewComment } from "./types.js";
import { ghJson, isNotFoundError } from "./github-cli.js";
import { mapReactions } from "./github-graphql.js";
import { exitWithMessage } from "./git-helpers.js";
import { tryFetchReview, type ReviewDetail } from "./fetch-review.js";
import { tryFetchIssueComment, type CommentDetail } from "./fetch-comment.js";
import { getThreadForComment, fetchThreadDetail } from "./fetch-thread.js";

type ThreadDetail = {
  type: "thread";
  id: number;
  path: string | null;
  line: number | null;
  isOutdated: boolean;
  isResolved: boolean;
  comments: Array<{
    id: number;
    author: string;
    body: string;
    createdAt: string;
    reactions: Reaction[];
  }>;
};

export type ItemDetail = ReviewDetail | ThreadDetail | CommentDetail;

/**
 * Fetch full thread data for display in the detail command.
 *
 * Uses two-stage lookup to minimize API rate limit usage:
 * 1. REST call to get comment (determines PR number)
 * 2. Lightweight GraphQL lookup to find thread (with early exit)
 * 3. Single GraphQL call to fetch that thread's full data
 *
 * This avoids paginating through all threads with full data.
 */
function tryFetchThread(
  owner: string,
  repo: string,
  itemId: number,
): ThreadDetail | undefined {
  try {
    // Get comment to determine PR number
    const comment = ghJson<PullRequestReviewComment>(
      "api",
      `repos/${owner}/${repo}/pulls/comments/${itemId}`,
    );

    // Stage 1: Lightweight lookup to find the thread (with early exit)
    const { thread: threadLookup } = getThreadForComment(
      owner,
      repo,
      itemId,
      comment,
    );

    // Stage 2: Fetch full thread data by node_id (single GraphQL call)
    const thread = fetchThreadDetail(threadLookup.id);
    if (!thread) return undefined;

    return {
      type: "thread",
      id: itemId,
      path: thread.path,
      line: thread.line,
      isOutdated: thread.isOutdated,
      isResolved: thread.isResolved,
      comments: thread.comments.nodes.map((c) => ({
        id: c.databaseId,
        author: c.author.login,
        body: c.body,
        createdAt: c.createdAt,
        reactions: mapReactions(c.reactionGroups),
      })),
    };
  } catch (error) {
    if (isNotFoundError(error)) return undefined;
    throw error;
  }
}

export function fetchItemDetail(
  owner: string,
  repo: string,
  itemId: number,
): ItemDetail {
  // Try thread first (most common for PR feedback)
  const thread = tryFetchThread(owner, repo, itemId);
  if (thread) return thread;

  // Try issue comment
  const comment = tryFetchIssueComment(owner, repo, itemId);
  if (comment) return comment;

  // Try review
  const review = tryFetchReview(owner, repo, itemId);
  if (review) return review;

  exitWithMessage(
    `Error: Could not find item #${itemId}. Commands now search only the current branch's PR; check out the target PR and retry if the item belongs elsewhere.`,
  );
}
