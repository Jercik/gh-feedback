import type { CapabilityResult, FeedbackBackend, FeedbackItemRef } from "./feedback-backend.js";
import type { ReactionContent } from "./types.js";

const WORKFLOW_REACTIONS: ReactionContent[] = ["eyes", "+1", "-1", "confused"];

export async function acknowledgeItem(
  backend: FeedbackBackend,
  item: FeedbackItemRef,
  viewerReactions: ReactionContent[],
): Promise<CapabilityResult> {
  const hadRocket = viewerReactions.includes("rocket");
  let rocketAdded = false;
  try {
    await backend.removeReactions(item, viewerReactions, WORKFLOW_REACTIONS);
    await backend.addReaction(item, "rocket");
    rocketAdded = !hadRocket;
    return await backend.complete(item, "acknowledged");
  } catch (completionError) {
    try {
      if (rocketAdded) {
        await backend.removeReactions(item, ["rocket"], ["rocket"]);
      }
      for (const reaction of viewerReactions.filter((value) =>
        WORKFLOW_REACTIONS.includes(value),
      )) {
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
