import type { CapabilityResult, FeedbackBackend, FeedbackItemRef } from "./feedback-backend.js";
import { otherStatusReactions, setStatusReaction } from "./set-status-reaction.js";
import type { ReactionContent } from "./types.js";

export async function acknowledgeItem(
  backend: FeedbackBackend,
  item: FeedbackItemRef,
  viewerReactions: ReactionContent[],
): Promise<CapabilityResult> {
  const hadRocket = viewerReactions.includes("rocket");
  let rocketAdded = false;
  try {
    await setStatusReaction(backend, item, viewerReactions, "rocket");
    rocketAdded = !hadRocket;
    return await backend.complete(item, "acknowledged");
  } catch (completionError) {
    try {
      if (rocketAdded) {
        await backend.removeReactions(item, ["rocket"], ["rocket"]);
      }
      const replaced = otherStatusReactions("rocket");
      for (const reaction of viewerReactions.filter((value) => replaced.includes(value))) {
        await backend.addReaction(item, reaction);
      }
    } catch (rollbackError) {
      console.error(
        `Warning: Could not restore prior reactions after completion failed: ${rollbackError instanceof Error ? rollbackError.message : String(rollbackError)}`,
      );
    }
    throw completionError;
  }
}
