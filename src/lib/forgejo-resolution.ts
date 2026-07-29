import { spawnSync } from "node:child_process";
import type { CapabilityResult, FeedbackItemRef } from "./feedback-backend.js";
import type { FeedbackOutcome } from "./feedback-backend.js";
import { forgejoApiHost, getFgjBinaryPath } from "./forgejo-cli.js";

const FORGEJO_UNSUPPORTED_HIDE =
  "Forgejo has no comment-hide API; status is tracked by reaction only.";

type ForgejoResolutionAction = "resolve" | "unresolve";

type ForgejoCompletionDecision = CapabilityResult | { action: ForgejoResolutionAction };

const OLD_FGJ_RESOLUTION_REASON =
  "installed fgj does not support conversation resolution; install the j4k build v0.5.0-j4k.4 or newer";

export function forgejoResolutionUnsupportedReason(message: string): string | undefined {
  let unsupportedReason: string | undefined;
  for (const rawLine of message.split(/\r?\n/u)) {
    const line = rawLine
      .trim()
      .toLowerCase()
      .replace(/^error:\s*/u, "");
    if (/^unknown flag:\s*--json$/u.test(line) || /^accepts 1 arg\(s\), received 3$/u.test(line)) {
      return OLD_FGJ_RESOLUTION_REASON;
    }
    if (
      /^(?:this forgejo instance has )?no conversation-?resolution api\b/u.test(line) ||
      /^(?:unknown command|unrecognized subcommand)\b/u.test(line)
    ) {
      unsupportedReason = message;
    }
  }
  return unsupportedReason;
}

export function isForgejoResolutionUnsupported(message: string): boolean {
  return forgejoResolutionUnsupportedReason(message) !== undefined;
}

export function isForgejoConversationResolvedBy(
  resolver: { login: string } | null | undefined,
  viewer: string,
): boolean {
  return resolver?.login === viewer;
}

export function forgejoResolutionArgs(
  action: ForgejoResolutionAction,
  apiHost: string,
  slug: string,
  prNumber: number,
  commentId: number,
): string[] {
  return [
    "--hostname",
    apiHost,
    "pr",
    "review",
    action,
    String(prNumber),
    String(commentId),
    "-R",
    slug,
    "--json",
  ];
}

export function changeForgejoConversationResolution(
  slug: string,
  item: FeedbackItemRef,
  action: ForgejoResolutionAction,
): CapabilityResult {
  if (item.type !== "thread") {
    return { supported: false, reason: FORGEJO_UNSUPPORTED_HIDE };
  }

  const binary = getFgjBinaryPath();
  // fgj owns fork capability detection and the display-line anchor derivation;
  // duplicating those rules around a raw REST call would create two clients.
  const result = spawnSync(
    binary,
    forgejoResolutionArgs(action, forgejoApiHost(), slug, item.prNumber, item.id),
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

export function decideForgejoCompletion(
  item: FeedbackItemRef,
  outcome: FeedbackOutcome,
  resolvedByViewer: boolean,
  resolvedByAnyone: boolean,
  notReadyReason: string | undefined,
): ForgejoCompletionDecision {
  if (item.type !== "thread") {
    return { supported: false, reason: FORGEJO_UNSUPPORTED_HIDE };
  }
  if (outcome === "disagreed") {
    if (resolvedByViewer) {
      return { action: "unresolve" };
    }
    return resolvedByAnyone
      ? {
          supported: true,
          applied: false,
          reason: "conversation resolution belongs to another user and was preserved",
        }
      : { supported: true, applied: false, reason: "conversation was already open" };
  }
  if (resolvedByAnyone) {
    return { supported: true, applied: false, reason: "conversation was already resolved" };
  }
  if (notReadyReason) {
    return {
      supported: true,
      applied: false,
      reason: notReadyReason,
    };
  }
  return { action: "resolve" };
}
