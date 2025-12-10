/**
 * Item detail fetching for read command.
 * Re-exports from specialized modules for backward compatibility.
 */

import type { Reaction } from "./types.js";
import { mapReactions } from "./github-graphql.js";
import { exitWithMessage } from "./git-helpers.js";
import { getThreadForComment } from "./fetch-thread.js";
import { tryFetchReview, type ReviewDetail } from "./fetch-review.js";
import { tryFetchIssueComment, type CommentDetail } from "./fetch-comment.js";

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

function tryFetchThread(
  owner: string,
  repo: string,
  itemId: number,
): ThreadDetail | undefined {
  try {
    const { thread } = getThreadForComment(owner, repo, itemId);
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
  } catch {
    return undefined;
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
