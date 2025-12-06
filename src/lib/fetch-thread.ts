/**
 * Thread fetching operations.
 */

import type {
  ReactionGroupNode,
  PullRequestReviewComment,
  ThreadInfo,
} from "./types.js";
import { ghJson } from "./github-cli.js";
import { getRepositoryInfo } from "./github-environment.js";
import { graphqlPaginate } from "./github-graphql.js";
import { exitWithMessage } from "./git-helpers.js";
import { THREAD_BY_COMMENT_QUERY } from "./graphql-queries.js";

type ThreadNode = {
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

export function getThreadForComment(
  owner: string,
  repo: string,
  commentDatabaseId: number,
  commentData?: PullRequestReviewComment,
): {
  prNumber: number;
  thread: ThreadNode;
} {
  const comment =
    commentData ??
    ghJson<PullRequestReviewComment>(
      "api",
      `repos/${owner}/${repo}/pulls/comments/${commentDatabaseId}`,
    );

  const prMatch = comment.pull_request_url.match(/\/pulls\/(\d+)$/u);
  if (!prMatch?.[1]) {
    throw new Error(
      `Could not determine PR for review comment #${commentDatabaseId}.`,
    );
  }
  const prNumber = Number.parseInt(prMatch[1]);

  const threads = graphqlPaginate<ThreadNode>(
    THREAD_BY_COMMENT_QUERY,
    { owner, repo, pr: prNumber },
    (response) => {
      const data = response as {
        data: {
          repository: {
            pullRequest: {
              reviewThreads: {
                pageInfo: { endCursor: string | null; hasNextPage: boolean };
                nodes: ThreadNode[];
              };
            };
          };
        };
      };
      return data.data.repository.pullRequest.reviewThreads;
    },
  );

  const thread = threads.find((t) =>
    t.comments.nodes.some((c) => c.databaseId === commentDatabaseId),
  );

  if (!thread) {
    throw new Error(
      `Thread containing comment #${commentDatabaseId} not found in PR #${prNumber}.`,
    );
  }

  return { prNumber, thread };
}

export function findThreadByCommentId(
  comment: PullRequestReviewComment,
  commentDatabaseId: number,
): {
  prNumber: number;
  thread: ThreadInfo;
} {
  try {
    const { owner, repo } = getRepositoryInfo();
    const { prNumber, thread } = getThreadForComment(
      owner,
      repo,
      commentDatabaseId,
      comment,
    );

    return {
      prNumber,
      thread: {
        id: thread.id,
        isResolved: thread.isResolved,
        path: thread.path ?? "(unknown)",
        line: thread.line,
        comments: thread.comments.nodes.map((c) => ({
          databaseId: c.databaseId,
          author: c.author,
          body: c.body,
        })),
      },
    };
  } catch (error) {
    exitWithMessage(
      `Error finding thread: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}
