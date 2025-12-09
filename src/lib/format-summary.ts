/**
 * Format PR feedback summary for LLM context.
 *
 * Output is optimized for:
 * - Quick understanding of all feedback points
 * - Identifying duplicate issues
 * - Understanding what responses were already given
 */

import type { PullRequestSummary, ThreadSummary } from "./types.js";

function formatThreadComments(thread: ThreadSummary): string[] {
  const lines: string[] = [];
  for (const comment of thread.comments) {
    lines.push(`  @${comment.author} (${comment.createdAt}):`);
    for (const bodyLine of comment.body.split("\n")) {
      lines.push(`    ${bodyLine}`);
    }
    lines.push("");
  }
  return lines;
}

function formatThread(thread: ThreadSummary): string[] {
  const status = thread.isResolved ? "[RESOLVED]" : "[OPEN]";
  const outdated = thread.isOutdated ? " (outdated)" : "";
  const location = thread.path
    ? `${thread.path}${thread.line ? `:${thread.line}` : ""}`
    : "general";

  return [
    `Thread #${thread.id} ${status}${outdated}`,
    `Location: ${location}`,
    "",
    ...formatThreadComments(thread),
  ];
}

export function formatSummary(summary: PullRequestSummary): string {
  const openThreads = summary.threads.filter((t) => !t.isResolved);
  const resolvedThreads = summary.threads.filter((t) => t.isResolved);

  const lines: string[] = [
    `Pull Request #${summary.number}: ${summary.title}`,
    `URL: ${summary.url}`,
    "",
    "Statistics:",
    `  Reviews: ${summary.reviews.length}`,
    `  Threads: ${openThreads.length} open, ${resolvedThreads.length} resolved`,
    `  Comments: ${summary.comments.length}`,
    "",
  ];

  // Reviews
  if (summary.reviews.length > 0) {
    lines.push("=".repeat(60), "REVIEWS", "=".repeat(60), "");

    for (const review of summary.reviews) {
      lines.push(
        `Review #${review.id} [${review.state}]`,
        `By: @${review.author} (${review.submittedAt})`,
        "",
      );
      for (const bodyLine of review.body.split("\n")) {
        lines.push(`  ${bodyLine}`);
      }
      lines.push("", "-".repeat(40), "");
    }
  }

  // Threads (code review comments)
  if (summary.threads.length > 0) {
    lines.push("=".repeat(60), "CODE REVIEW THREADS", "=".repeat(60), "");

    if (openThreads.length > 0) {
      lines.push("--- Open Threads ---", "");
      for (const thread of openThreads) {
        lines.push(...formatThread(thread), "-".repeat(40), "");
      }
    }

    if (resolvedThreads.length > 0) {
      lines.push("--- Resolved Threads ---", "");
      for (const thread of resolvedThreads) {
        lines.push(...formatThread(thread), "-".repeat(40), "");
      }
    }
  }

  // General comments (conversation tab)
  if (summary.comments.length > 0) {
    lines.push("=".repeat(60), "GENERAL COMMENTS", "=".repeat(60), "");

    for (const comment of summary.comments) {
      lines.push(
        `Comment #${comment.id}`,
        `By: @${comment.author} (${comment.createdAt})`,
        "",
      );
      for (const bodyLine of comment.body.split("\n")) {
        lines.push(`  ${bodyLine}`);
      }
      lines.push("", "-".repeat(40), "");
    }
  }

  // Summary footer with context for LLM
  if (
    summary.reviews.length === 0 &&
    summary.threads.length === 0 &&
    summary.comments.length === 0
  ) {
    lines.push("No feedback found on this pull request.");
  }

  return lines.join("\n");
}
