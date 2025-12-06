/**
 * Comment formatters for command output.
 */

import type {
  IssueComment,
  CommentInfo,
  ThreadInfo,
  ReactionSummary,
  Classifier,
} from "./types.js";
import { ALLOWED_REACTIONS } from "./constants.js";

export function formatCommentInfo(comment: CommentInfo): string {
  const lines: string[] = [`Comment #${comment.id} by @${comment.author}`];

  if (comment.path && comment.line !== null) {
    lines.push(`Location: ${comment.path}:${comment.line}`);
  }

  if (comment.inReplyToId) {
    lines.push(
      `\u26A0\uFE0F  Warning: This is already a reply to comment #${comment.inReplyToId}`,
      `   (You cannot reply to replies, only to top-level review comments)`,
    );
  }

  lines.push("\nOriginal comment:", "---");
  const bodyLines = comment.body.split("\n");
  for (const line of bodyLines) {
    lines.push(`> ${line}`);
  }
  lines.push("---");

  return lines.join("\n");
}

export function formatThreadPreview(
  prNumber: number,
  thread: ThreadInfo,
  action: "resolve" | "unresolve",
): string {
  const lines: string[] = [
    `Review comment thread on PR #${prNumber}`,
    `File: ${thread.path}${thread.line ? `:${thread.line}` : ""}`,
    `Status: ${thread.isResolved ? "resolved" : "unresolved"}`,
    `Comments: ${thread.comments.length}`,
    "",
  ];

  const firstComment = thread.comments[0];
  if (firstComment) {
    lines.push(`First comment by @${firstComment.author.login}:`);
    const bodyPreview =
      firstComment.body.length > 200
        ? firstComment.body.slice(0, 200) + "..."
        : firstComment.body;
    lines.push(bodyPreview, "");
  }

  lines.push(`Action: ${action} thread`);
  return lines.join("\n");
}

export function formatHidePreview(
  issue: { number: number; title: string },
  comment: IssueComment,
  reason: Classifier,
): string {
  const lines: string[] = [
    `Comment #${comment.id} on PR #${issue.number}: ${issue.title}`,
    `Author: @${comment.user.login}`,
    `URL: ${comment.html_url}`,
    `Created: ${comment.created_at}`,
  ];
  if (comment.updated_at !== comment.created_at)
    lines.push(`Updated: ${comment.updated_at}`);
  lines.push("", `Action: minimize with reason ${reason}`);
  return lines.join("\n");
}

export function summarizeReactions(comment: IssueComment): ReactionSummary[] {
  const summary: ReactionSummary[] = [];
  if (!comment.reactions) return summary;
  for (const content of ALLOWED_REACTIONS) {
    const count = comment.reactions[content];
    if (count > 0) {
      summary.push({ content, count });
    }
  }
  return summary;
}

export function formatReactPreview(
  issue: { number: number; title: string },
  comment: IssueComment,
  reactions: ReactionSummary[],
): string {
  const lines: string[] = [
    `Comment #${comment.id} on PR #${issue.number}: ${issue.title}`,
    `Author: @${comment.user.login}`,
    `URL: ${comment.html_url}`,
    `Created: ${comment.created_at}`,
  ];
  if (comment.updated_at !== comment.created_at) {
    lines.push(`Updated: ${comment.updated_at}`);
  }

  if (reactions.length > 0) {
    const reactionSummary = reactions
      .map(
        (reaction) =>
          `${reaction.content.replaceAll("_", " ")} (${reaction.count})`,
      )
      .join(", ");
    lines.push(`Existing reactions: ${reactionSummary}`);
  } else if (!comment.reactions || comment.reactions.total_count === 0) {
    lines.push("Existing reactions: none");
  }

  return lines.join("\n");
}
