import type { FeedbackBackend, FeedbackItemRef } from "./feedback-backend.js";
import { exitWithMessage } from "./git-helpers.js";
import type { ReactionContent } from "./types.js";

export async function getOpenItemReactions(
  backend: FeedbackBackend,
  item: FeedbackItemRef,
): Promise<ReactionContent[]> {
  const { doneStatus, viewerReactions } = await backend.getItemStatus(item);
  if (doneStatus) {
    exitWithMessage(
      `Error: Item #${item.id} is already "${doneStatus}". ` +
        `Use 'start' first to re-open it before changing status.`,
    );
  }
  return viewerReactions;
}
