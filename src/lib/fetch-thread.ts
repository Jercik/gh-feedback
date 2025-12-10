/**
 * Thread fetching operations.
 *
 * Uses lightweight queries with early exit to minimize API rate limit usage.
 */

import type { PullRequestReviewComment } from "./types.js";
import { ghJson } from "./github-cli.js";
import { graphqlQuery } from "./github-graphql.js";
import { THREAD_LOOKUP_QUERY } from "./graphql-queries.js";

/**
 * Minimal thread info returned by the lookup query.
 * Only contains data needed for DetectedItem.
 */
type ThreadLookupResult = {
  id: string;
  isResolved: boolean;
  isOutdated: boolean;
  path: string | null;
  line: number | null;
};

/**
 * Response shape for the lightweight thread lookup query.
 */
type ThreadLookupResponse = {
  data: {
    repository: {
      pullRequest: {
        reviewThreads: {
          pageInfo: { endCursor: string | null; hasNextPage: boolean };
          nodes: Array<{
            id: string;
            isResolved: boolean;
            isOutdated: boolean;
            path: string | null;
            line: number | null;
            comments: {
              nodes: Array<{ databaseId: number }>;
            };
          }>;
        };
      };
    };
  };
};

/**
 * Find a thread by comment ID using lightweight query with early exit.
 *
 * Optimized for rate limits:
 * - Uses minimal query (only fetches databaseId for comments)
 * - Fetches 100 threads per page
 * - Stops paginating as soon as thread is found
 *
 * @returns Thread info or undefined if not found
 */
function findThreadByCommentId(
  owner: string,
  repo: string,
  prNumber: number,
  commentDatabaseId: number,
): ThreadLookupResult | undefined {
  let cursor: string | undefined;
  let hasNextPage = true;

  while (hasNextPage) {
    const variables: Record<string, string | number> = {
      owner,
      repo,
      pr: prNumber,
    };
    if (cursor) {
      variables.cursor = cursor;
    }

    const response = graphqlQuery<ThreadLookupResponse>(
      THREAD_LOOKUP_QUERY,
      variables,
    );

    const { pageInfo, nodes } =
      response.data.repository.pullRequest.reviewThreads;

    // Search this page for the thread containing our comment
    for (const thread of nodes) {
      const found = thread.comments.nodes.some(
        (c) => c.databaseId === commentDatabaseId,
      );
      if (found) {
        // Early exit - found the thread!
        return {
          id: thread.id,
          isResolved: thread.isResolved,
          isOutdated: thread.isOutdated,
          path: thread.path,
          line: thread.line,
        };
      }
    }

    // Continue to next page if not found
    hasNextPage = pageInfo.hasNextPage && pageInfo.endCursor !== null;
    cursor = pageInfo.endCursor ?? undefined;
  }

  return undefined;
}

/**
 * Extract PR number from a pull request comment.
 */
function extractPrNumber(
  comment: PullRequestReviewComment,
  commentDatabaseId: number,
): number {
  const prMatch = comment.pull_request_url.match(/\/pulls\/(\d+)$/u);
  if (!prMatch?.[1]) {
    throw new Error(
      `Could not determine PR for review comment #${commentDatabaseId}.`,
    );
  }
  return Number.parseInt(prMatch[1]);
}

/**
 * Get thread info for a review comment (lightweight).
 *
 * Uses lightweight lookup query with early exit to minimize API usage.
 * Returns minimal thread data sufficient for item detection and mutations.
 */
export function getThreadForComment(
  owner: string,
  repo: string,
  commentDatabaseId: number,
  commentData?: PullRequestReviewComment,
): {
  prNumber: number;
  thread: ThreadLookupResult;
} {
  // Get comment data to determine PR number
  const comment =
    commentData ??
    ghJson<PullRequestReviewComment>(
      "api",
      `repos/${owner}/${repo}/pulls/comments/${commentDatabaseId}`,
    );

  const prNumber = extractPrNumber(comment, commentDatabaseId);

  // Find thread using lightweight query with early exit
  const thread = findThreadByCommentId(
    owner,
    repo,
    prNumber,
    commentDatabaseId,
  );

  if (!thread) {
    throw new Error(
      `Thread containing comment #${commentDatabaseId} not found in PR #${prNumber}.`,
    );
  }

  return { prNumber, thread };
}
