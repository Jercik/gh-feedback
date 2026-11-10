import { createForgejoBackend } from "./forgejo-backend.js";
import { resolveFeedbackTarget } from "./feedback-target.js";
import type { FeedbackTarget, TargetOptions } from "./feedback-target.js";
import type { FeedbackBackend } from "./feedback-backend.js";

export async function resolveBackend(
  options: TargetOptions,
): Promise<{ backend: FeedbackBackend; target: FeedbackTarget }> {
  const target = await resolveFeedbackTarget(options);
  return { backend: createForgejoBackend(target), target };
}
