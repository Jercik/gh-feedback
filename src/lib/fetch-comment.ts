/**
 * Comment fetching operations.
 */

import type {
  IssueComment,
  CommentInfo,
  PullRequestReviewComment,
  Reaction,
} from "./types.js";
import { ghJson } from "./github-cli.js";
import { getPullRequestNumber } from "./github-environment.js";
import { exitWithMessage } from "./git-helpers.js";

export type CommentDetail = {
  type: "comment";
  id: number;
  author: string;
  url: string;
  createdAt: string;
  body: string;
  reactions: Reaction[];
};

export function fetchIssueComment(
  ownerRepo: string,
  commentId: number,
): {
  comment: IssueComment;
  issue: { number: number; title: string; pull_request?: object };
} {
  try {
    const comment = ghJson<IssueComment>(
      "api",
      `repos/${ownerRepo}/issues/comments/${commentId}`,
    );

    const issueUrl = new URL(comment.issue_url);
    if (issueUrl.hostname !== "api.github.com") {
      exitWithMessage(`Error: Unexpected API URL: ${comment.issue_url}`);
    }
    const issuePath = issueUrl.pathname.slice(1);
    const issue = ghJson<{
      number: number;
      title: string;
      pull_request?: object;
    }>("api", issuePath);

    if (!issue.pull_request) {
      exitWithMessage(
        `Error: Comment #${commentId} belongs to issue #${issue.number}, not a pull request.`,
      );
    }

    return { comment, issue };
  } catch (error) {
    exitWithMessage(
      `Error fetching comment: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}

export function getCommentInfo(
  ownerRepo: string,
  commentId: number,
): CommentInfo {
  const prNumber = getPullRequestNumber();

  try {
    const comment = ghJson<{
      id: number;
      body: string;
      path: string | null;
      line: number | null;
      in_reply_to_id: number | null;
      user: { login: string };
      pull_request_url: string;
    }>("api", `repos/${ownerRepo}/pulls/comments/${commentId}`);

    return {
      id: comment.id,
      pullRequestNumber: prNumber,
      path: comment.path,
      line: comment.line,
      body: comment.body,
      author: comment.user.login,
      inReplyToId: comment.in_reply_to_id,
    };
  } catch (error) {
    if (error instanceof Error && error.message.includes("404")) {
      exitWithMessage(
        `Error: Comment #${commentId} not found in PR #${prNumber}.`,
      );
    }
    exitWithMessage(
      `Error fetching comment info: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}

export function fetchReviewComment(
  ownerRepo: string,
  commentId: number,
): PullRequestReviewComment {
  try {
    return ghJson<PullRequestReviewComment>(
      "api",
      `repos/${ownerRepo}/pulls/comments/${commentId}`,
    );
  } catch (error) {
    exitWithMessage(
      `Error fetching review comment #${commentId}: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}

export function postReply(
  ownerRepo: string,
  prNumber: number,
  commentId: number,
  replyText: string,
): { id: number; url: string } {
  try {
    const result = ghJson<{ id: number; html_url: string }>(
      "api",
      "-X",
      "POST",
      "-H",
      "Accept: application/vnd.github+json",
      `repos/${ownerRepo}/pulls/${prNumber}/comments/${commentId}/replies`,
      "-f",
      `body=${replyText}`,
    );

    return { id: result.id, url: result.html_url };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    if (errorMessage.includes("404")) {
      exitWithMessage(
        `Error: Unable to reply to comment #${commentId}. This may be because:\n` +
          `  1. The comment doesn't exist\n` +
          `  2. It's already a reply to another comment (can't reply to replies)\n` +
          `  3. Insufficient permissions\n` +
          `Use 'gh-feedback status ${prNumber}' to see available threads.`,
      );
    }
    exitWithMessage(`Error posting reply: ${errorMessage}`);
  }
}

export function tryFetchIssueComment(
  owner: string,
  repo: string,
  itemId: number,
): CommentDetail | undefined {
  try {
    const comment = ghJson<IssueComment>(
      "api",
      `repos/${owner}/${repo}/issues/comments/${itemId}`,
    );
    return {
      type: "comment",
      id: comment.id,
      author: comment.user.login,
      url: comment.html_url,
      createdAt: comment.created_at,
      body: comment.body,
      reactions: comment.reactions
        ? Object.entries(comment.reactions)
            .filter(
              (entry): entry is [string, number] =>
                entry[0] !== "total_count" &&
                typeof entry[1] === "number" &&
                entry[1] > 0,
            )
            .map(([key, value]) => ({
              content: key,
              count: value,
              viewerHasReacted: false,
              users: [],
            }))
        : [],
    };
  } catch {
    return undefined;
  }
}
