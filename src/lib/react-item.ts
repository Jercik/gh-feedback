/**
 * Add or remove reactions from any feedback item.
 *
 * Works for threads, comments, and reviews - all use the same
 * GraphQL mutation with the node ID.
 */

import type { ReactionContent } from "./types.js";
import type { DetectedItem } from "./detect-item-type.js";
import { addReaction, removeReaction } from "./github-mutations.js";

type ReactResult = {
  content: string;
};

export function addReactionToItem(
  item: DetectedItem,
  reaction: ReactionContent,
): ReactResult {
  return addReaction(item.nodeId, reaction);
}

function removeReactionFromItem(
  item: DetectedItem,
  reaction: ReactionContent,
): ReactResult {
  return removeReaction(item.nodeId, reaction);
}

/**
 * Try to remove a reaction, ignoring "not found" errors.
 * Logs warnings for unexpected errors to aid debugging.
 */
export function tryRemoveReactionFromItem(
  item: DetectedItem,
  reaction: ReactionContent,
): void {
  try {
    removeReactionFromItem(item, reaction);
  } catch (error) {
    // Expected when reaction doesn't exist - silently ignore
    const message = error instanceof Error ? error.message : String(error);
    if (!message.includes("not found") && !message.includes("does not exist")) {
      // Unexpected error - log for debugging but don't fail the workflow
      console.error(
        `Warning: Failed to remove ${reaction} reaction: ${message}`,
      );
    }
  }
}
