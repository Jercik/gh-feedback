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

export function removeReactionFromItem(
  item: DetectedItem,
  reaction: ReactionContent,
): ReactResult {
  return removeReaction(item.nodeId, reaction);
}
