import type { CapabilityResult } from "./feedback-backend.js";
import { forgejoApiHost } from "./forgejo-api-host.js";
import {
  forgejoResolutionArgs,
  forgejoResolutionUnsupportedReason,
  type ForgejoResolutionAction,
} from "./forgejo-resolution.js";
import { runFgj } from "./run-fgj.js";

export function changeForgejoConversationResolution(
  slug: string,
  prNumber: number,
  commentId: number,
  action: ForgejoResolutionAction,
): CapabilityResult {
  // fgj owns capability detection and anchor derivation; a raw REST fallback would create two clients.
  const result = runFgj(forgejoResolutionArgs(action, forgejoApiHost(), slug, prNumber, commentId));

  if (!result.ok) {
    const unsupportedReason = forgejoResolutionUnsupportedReason(result.message);
    if (unsupportedReason) {
      return { supported: false, reason: unsupportedReason };
    }
    throw new Error(result.message);
  }

  return { supported: true, applied: true };
}
