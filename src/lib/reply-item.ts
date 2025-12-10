/**
 * Reply to feedback items.
 *
 * - Threads: use PR review comment reply API
 * - Comments: post a new PR comment (no native reply support)
 * - Reviews: post a new PR comment (no native reply support)
 */

import type { DetectedItem } from "./detect-item-type.js";
import { ghJson } from "./github-cli.js";
import { getRepositoryInfo } from "./github-environment.js";
import { exitWithMessage } from "./git-helpers.js";

type ReplyResult = {
  id: number;
  url: string;
};

/** GitHub API limit for comment body length */
const MAX_COMMENT_LENGTH = 65_536;

function replyToThread(
  ownerRepo: string,
  prNumber: number,
  commentId: number,
  message: string,
): ReplyResult {
  try {
    const result = ghJson<{ id: number; html_url: string }>(
      "api",
      "-X",
      "POST",
      "-H",
      "Accept: application/vnd.github+json",
      `repos/${ownerRepo}/pulls/${prNumber}/comments/${commentId}/replies`,
      "--raw-field",
      `body=${message}`,
    );

    return { id: result.id, url: result.html_url };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    if (errorMessage.includes("404")) {
      exitWithMessage(
        `Error: Unable to reply to thread #${commentId}. ` +
          `This may be a reply to another comment (can't reply to replies).`,
      );
    }
    exitWithMessage(`Error posting reply: ${errorMessage}`);
  }
}

function postPRComment(
  ownerRepo: string,
  prNumber: number,
  message: string,
): ReplyResult {
  try {
    const result = ghJson<{ id: number; html_url: string }>(
      "api",
      "-X",
      "POST",
      "-H",
      "Accept: application/vnd.github+json",
      `repos/${ownerRepo}/issues/${prNumber}/comments`,
      "--raw-field",
      `body=${message}`,
    );

    return { id: result.id, url: result.html_url };
  } catch (error) {
    exitWithMessage(
      `Error posting comment: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}

export function replyToItem(item: DetectedItem, message: string): ReplyResult {
  const { ownerRepo } = getRepositoryInfo();

  if (item.type === "thread") {
    if (message.length > MAX_COMMENT_LENGTH) {
      exitWithMessage(
        `Error: Message too long (${message.length} chars). ` +
          `GitHub allows a maximum of ${MAX_COMMENT_LENGTH} characters.`,
      );
    }
    return replyToThread(ownerRepo, item.prNumber, item.id, message);
  }

  // For comments and reviews, post a new PR comment
  // Include reference to the original item
  const prefix =
    item.type === "comment"
      ? `> Replying to comment #${item.id}\n\n`
      : `> Replying to review #${item.id}\n\n`;

  const fullMessage = prefix + message;

  if (fullMessage.length > MAX_COMMENT_LENGTH) {
    exitWithMessage(
      `Error: Message too long (${fullMessage.length} chars including prefix). ` +
        `GitHub allows a maximum of ${MAX_COMMENT_LENGTH} characters.`,
    );
  }

  return postPRComment(ownerRepo, item.prNumber, fullMessage);
}
