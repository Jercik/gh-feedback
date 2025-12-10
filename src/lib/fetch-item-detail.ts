/**
 * Item detail fetching for read command.
 * Re-exports from specialized modules for backward compatibility.
 */

import type {
  Reaction,
  ReactionGroupNode,
  PullRequestReviewComment,
} from "./types.js";
import { ghJson, isNotFoundError } from "./github-cli.js";
import { mapReactions, graphqlPaginate } from "./github-graphql.js";
import { exitWithMessage } from "./git-helpers.js";
import { THREAD_BY_COMMENT_QUERY } from "./graphql-queries.js";
import { tryFetchReview, type ReviewDetail } from "./fetch-review.js";
import { tryFetchIssueComment, type CommentDetail } from "./fetch-comment.js";

/**
 * Full thread node with complete comment data for display.
 */
type FullThreadNode = {
  id: string;
  isResolved: boolean;
  isOutdated: boolean;
  path: string | null;
  line: number | null;
  comments: {
    nodes: Array<{
      databaseId: number;
      author: { login: string };
      body: string;
      path: string | null;
      line: number | null;
      createdAt: string;
      reactionGroups: ReactionGroupNode[];
    }>;
  };
};

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
 * Returns undefined if thread not found.
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

    const prMatch = comment.pull_request_url.match(/\/pulls\/(\d+)$/u);
    if (!prMatch?.[1]) return undefined;
    const prNumber = Number.parseInt(prMatch[1]);

    // Fetch all threads with full data for display
    const threads = graphqlPaginate<FullThreadNode>(
      THREAD_BY_COMMENT_QUERY,
      { owner, repo, pr: prNumber },
      (response) => {
        const data = response as {
          data: {
            repository: {
              pullRequest: {
                reviewThreads: {
                  pageInfo: { endCursor: string | null; hasNextPage: boolean };
                  nodes: FullThreadNode[];
                };
              };
            };
          };
        };
        return data.data.repository.pullRequest.reviewThreads;
      },
    );

    const thread = threads.find((t) =>
      t.comments.nodes.some((c) => c.databaseId === itemId),
    );

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
