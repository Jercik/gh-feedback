import type { FeedbackBackend, FeedbackItemRef } from "./feedback-backend.js";
import type { ReactionContent } from "./types.js";

const CONFLICTING_REACTIONS: ReactionContent[] = ["+1", "-1", "rocket", "confused"];

export async function startItem(
  backend: FeedbackBackend,
  item: FeedbackItemRef,
  viewerReactions: ReactionContent[],
  isMinimized: boolean,
  needsReopen: boolean,
): Promise<void> {
  if (needsReopen) {
    const result = await backend.unresolve(item, isMinimized);
    if (!result.supported) {
      throw new Error(`Reopen skipped: ${result.reason}`);
    }
    if (!result.applied) {
      throw new Error(`Reopen failed: ${result.reason}`);
    }
  }

  await backend.removeReactions(item, viewerReactions, CONFLICTING_REACTIONS);
  await backend.addReaction(item, "eyes");
}
