/**
 * Comment fetching operations.
 */

import type { IssueComment, Reaction } from "./types.js";
import { ghJson, isNotFoundError } from "./github-cli.js";

export type CommentDetail = {
  type: "comment";
  id: number;
  author: string;
  url: string;
  createdAt: string;
  body: string;
  reactions: Reaction[];
};

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
      author: comment.user?.login ?? "ghost",
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
  } catch (error) {
    if (isNotFoundError(error)) return undefined;
    throw error;
  }
}
