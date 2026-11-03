import type { CapabilityResult, FeedbackBackend, FeedbackItemRef } from "./feedback-backend.js";
import { restoreStatus, setStatus } from "./set-status.js";
import type { ReactionContent } from "./types.js";

export async function acknowledgeItem(
  backend: FeedbackBackend,
  item: FeedbackItemRef,
  viewerReactions: ReactionContent[],
): Promise<CapabilityResult> {
  try {
    await setStatus(backend, item, viewerReactions, "acknowledged");
    return await backend.complete(item, "acknowledged");
  } catch (completionError) {
    try {
      await restoreStatus(backend, item, viewerReactions, "acknowledged");
    } catch (rollbackError) {
      console.error(
        `Warning: Could not restore prior reactions after completion failed: ${rollbackError instanceof Error ? rollbackError.message : String(rollbackError)}`,
      );
    }
    throw completionError;
  }
}
