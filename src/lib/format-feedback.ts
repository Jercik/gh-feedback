/**
 * Feedback formatters for status command output.
 */

import type { PullRequestFeedback } from "./types.js";

/** Convert reaction content names to ASCII labels */
function reactionToLabel(reaction: string): string {
  const map: Record<string, string> = {
    THUMBS_UP: "+1",
    THUMBS_DOWN: "-1",
    LAUGH: "laugh",
    HOORAY: "hooray",
    CONFUSED: "confused",
    HEART: "heart",
    ROCKET: "rocket",
    EYES: "eyes",
  };
  return map[reaction] ?? reaction.toLowerCase();
}

/** Format viewer reactions as ASCII string */
function formatViewerReactions(reactions: readonly string[]): string {
  if (reactions.length === 0) return "";
  const labels = reactions.map((r) => reactionToLabel(r)).join(" ");
  return `  reacted: ${labels}`;
}

export function formatAllFeedback(feedback: PullRequestFeedback): string {
  const lines: string[] = [
    `Pull Request #${feedback.number}: ${feedback.title}`,
    `URL: ${feedback.url}`,
    "",
  ];

  // Reviews
  if (feedback.reviews.length === 0) {
    lines.push("Reviews: none");
  } else {
    lines.push(`Reviews (${feedback.reviews.length}):`);
    for (const review of feedback.reviews) {
      const reactions = formatViewerReactions(review.viewerReactions);
      const hidden = review.isMinimized
        ? `  [hidden: ${review.minimizedReason ?? "unknown"}]`
        : "";
      lines.push(
        `  #${review.id}  ${review.state}  @${review.author}  ${review.submittedAt}${reactions}${hidden}`,
      );
    }
  }
  lines.push("");

  // Threads
  if (feedback.threads.length === 0) {
    lines.push("Threads: none");
  } else {
    lines.push(`Threads (${feedback.threads.length}):`);
    for (const thread of feedback.threads) {
      const location =
        thread.path && thread.line !== null
          ? `${thread.path}:${thread.line}`
          : (thread.path ?? "unknown");
      const replies =
        thread.replyCount > 0 ? `${thread.replyCount} replies` : "0 replies";
      const reactions = formatViewerReactions(thread.viewerReactions);
      const outdated = thread.isOutdated ? "  outdated" : "";
      const resolved = thread.isResolved ? "  [resolved]" : "";
      lines.push(
        `  #${thread.id}  ${location}  @${thread.author}  ${thread.createdAt}  ${replies}${reactions}${outdated}${resolved}`,
      );
    }
  }
  lines.push("");

  // Comments
  if (feedback.comments.length === 0) {
    lines.push("Comments: none");
  } else {
    lines.push(`Comments (${feedback.comments.length}):`);
    for (const comment of feedback.comments) {
      const reactions = formatViewerReactions(comment.viewerReactions);
      const hidden = comment.isMinimized ? "  [hidden]" : "";
      lines.push(
        `  #${comment.id}  @${comment.author}  ${comment.createdAt}${reactions}${hidden}`,
      );
    }
  }

  return lines.join("\n");
}
