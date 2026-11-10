import type { FeedbackBackend, FeedbackItemRef } from "./feedback-backend.js";
import { doneItemMessage } from "./done-item-message.js";
import { exitWithMessage } from "./git-helpers.js";
import type { ReactionContent } from "./types.js";

export async function getOpenItemReactions(
  backend: FeedbackBackend,
  item: FeedbackItemRef,
): Promise<ReactionContent[]> {
  const { doneStatus, viewerReactions } = await backend.getItemStatus(item);
  if (doneStatus) {
    exitWithMessage(doneItemMessage(item.id, doneStatus));
  }
  return viewerReactions;
}
