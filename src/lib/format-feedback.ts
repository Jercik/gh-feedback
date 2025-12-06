/**
 * Feedback formatters for status command output.
 */

import type { PullRequestFeedback } from "./types.js";

/** Convert reaction content names to emoji */
function reactionToEmoji(reaction: string): string {
  const map: Record<string, string> = {
    THUMBS_UP: "\u{1F44D}",
    THUMBS_DOWN: "\u{1F44E}",
    LAUGH: "\u{1F604}",
    HOORAY: "\u{1F389}",
    CONFUSED: "\u{1F615}",
    HEART: "\u2764\uFE0F",
    ROCKET: "\u{1F680}",
    EYES: "\u{1F440}",
  };
  return map[reaction] ?? reaction;
}

/** Format viewer reactions as emoji string */
function formatViewerReactions(reactions: readonly string[]): string {
  if (reactions.length === 0) return "";
  const emojis = reactions.map((r) => reactionToEmoji(r)).join(" ");
  return `  reacted: ${emojis}`;
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
