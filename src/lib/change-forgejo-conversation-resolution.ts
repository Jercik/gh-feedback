import { spawnSync } from "node:child_process";
import type { CapabilityResult } from "./feedback-backend.js";
import { forgejoApiHost, getFgjBinaryPath } from "./forgejo-cli.js";
import {
  forgejoResolutionArgs,
  forgejoResolutionUnsupportedReason,
  type ForgejoResolutionAction,
} from "./forgejo-resolution.js";

export function changeForgejoConversationResolution(
  slug: string,
  prNumber: number,
  commentId: number,
  action: ForgejoResolutionAction,
): CapabilityResult {
  const binary = getFgjBinaryPath();
  // fgj owns capability detection and anchor derivation; a raw REST fallback would create two clients.
  const result = spawnSync(
    binary,
    forgejoResolutionArgs(action, forgejoApiHost(), slug, prNumber, commentId),
    { encoding: "utf8" },
  );

  if (result.error) {
    const error = result.error as NodeJS.ErrnoException;
    if (error.code === "ENOENT") {
      throw new Error(`Error: Required dependency 'fgj' not found at ${binary}.`);
    }
    throw result.error;
  }

  if (result.status !== 0) {
    const fallback = result.signal
      ? `fgj exited on signal ${result.signal}`
      : `fgj exited ${result.status}`;
    const message = result.stderr.trim() || result.stdout.trim() || fallback;
    const unsupportedReason = forgejoResolutionUnsupportedReason(message);
    if (unsupportedReason) {
      return { supported: false, reason: unsupportedReason };
    }
    throw new Error(message);
  }

  return { supported: true, applied: true };
}
