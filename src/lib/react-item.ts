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
 * Remove only the reactions that the viewer has actually added.
 *
 * More efficient than blindly trying to remove all possible conflicting
 * reactions - only makes API calls for reactions that exist.
 */
export function removeViewerReactions(
  item: DetectedItem,
  viewerReactions: ReactionContent[],
  toRemove: ReactionContent[],
): void {
  const reactionsToRemove = toRemove.filter((r) => viewerReactions.includes(r));
  for (const reaction of reactionsToRemove) {
    removeReactionFromItem(item, reaction);
  }
}
