/**
 * Check for unresolved sibling threads in multi-thread reviews.
 *
 * Prevents hiding legitimate unresolved feedback when resolving
 * a review that contains multiple comment threads.
 */

import type { DetectedItem, SiblingThread } from "./detect-item-type.js";
import { exitWithMessage } from "./git-helpers.js";
import { WARNING } from "./tty-output.js";

/** Format location for display */
function formatLocation(thread: SiblingThread): string {
  if (!thread.path) return `#${thread.commentId}`;
  const line = thread.line ? `:${thread.line}` : "";
  return `${thread.path}${line}`;
}

/**
 * Get unresolved sibling threads that would be hidden.
 *
 * For reviews WITHOUT body (containers): excludes the target thread
 * For reviews WITH body: includes ALL threads (no target thread)
 *
 * Returns undefined if there are no concerns.
 */
function getUnresolvedSiblingThreads(
  item: DetectedItem,
): SiblingThread[] | undefined {
  if (!item.siblingThreads || item.siblingThreads.length === 0) {
    return undefined;
  }

  // For reviews with body (no target thread), ALL threads are siblings
  // For reviews without body, exclude the target thread
  const hasTargetThread = item.threadId !== undefined;

  const unresolvedSiblings = item.siblingThreads
    .filter((t) => !hasTargetThread || t.id !== item.threadId)
    .filter((t) => !t.isResolved);

  return unresolvedSiblings.length > 0 ? unresolvedSiblings : undefined;
}

/**
 * Check for unresolved sibling threads and exit with error if found.
 *
 * Call this before resolving a review to prevent hiding unresolved feedback.
 *
 * @param item - The detected item being resolved
 * @param actionVerb - The action being performed (e.g., "ACK", "agree with", "disagree with")
 */
export function blockIfUnresolvedSiblings(
  item: DetectedItem,
  actionVerb: string,
): void {
  const unresolvedSiblings = getUnresolvedSiblingThreads(item);
  if (!unresolvedSiblings) {
    return;
  }

  console.error("");
  console.error(
    `${WARNING} This review contains ${item.siblingThreads?.length} threads, ` +
      `${unresolvedSiblings.length} still unresolved:`,
  );
  for (const sibling of unresolvedSiblings) {
    const location = sibling.path ? ` at ${formatLocation(sibling)}` : "";
    console.error(`  - #${sibling.commentId}${location}`);
  }
  console.error("");
  exitWithMessage(
    `Error: Cannot ${actionVerb} review #${item.id} - it would hide unresolved feedback.\n` +
      `Handle each thread individually instead:\n` +
      unresolvedSiblings
        .map((s) => `  gh-feedback <command> ${s.commentId}`)
        .join("\n"),
  );
}
