import type { FeedbackBackend, FeedbackItemRef } from "./feedback-backend.js";
import { setStatusReaction } from "./set-status-reaction.js";
import type { ReactionContent } from "./types.js";

export async function startItem(
  backend: FeedbackBackend,
  item: FeedbackItemRef,
  viewerReactions: ReactionContent[],
  needsReopen: boolean,
): Promise<void> {
  if (needsReopen) {
    const result = await backend.unresolve(item);
    if (!result.supported) {
      throw new Error(`Reopen skipped: ${result.reason}`);
    }
    if (!result.applied) {
      throw new Error(`Reopen failed: ${result.reason}`);
    }
  }

  await setStatusReaction(backend, item, viewerReactions, "eyes");
}
