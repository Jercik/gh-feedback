import { spawnSync } from "node:child_process";
import type { CapabilityResult, FeedbackItemRef } from "./feedback-backend.js";
import type { FeedbackOutcome } from "./feedback-backend.js";
import { forgejoApiHost, getFgjBinaryPath } from "./forgejo-cli.js";

const FORGEJO_UNSUPPORTED_HIDE =
  "Forgejo has no comment-hide API; status is tracked by reaction only.";

type ForgejoResolutionAction = "resolve" | "unresolve";

const UNSUPPORTED_RESOLUTION_MESSAGES = [
  "no conversation-resolution API",
  "no conversation resolution API",
  "not allowed to mark this conversation",
  "authentication required",
  "repository is archived",
  "unknown command",
  "unrecognized subcommand",
  "accepts 1 arg(s), received 3",
];

export function isForgejoResolutionUnsupported(message: string): boolean {
  return UNSUPPORTED_RESOLUTION_MESSAGES.some((expected) => message.includes(expected));
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
    const message = result.stderr.trim() || result.stdout.trim() || `fgj exited ${result.status}`;
    if (isForgejoResolutionUnsupported(message)) {
      return { supported: false, reason: message };
    }
    throw new Error(message);
  }

  return { supported: true, applied: true };
}

export function completeForgejoOutcome(
  slug: string,
  item: FeedbackItemRef,
  outcome: FeedbackOutcome,
  resolvedByViewer: boolean,
): CapabilityResult {
  if (outcome === "disagreed") {
    return resolvedByViewer
      ? changeForgejoConversationResolution(slug, item, "unresolve")
      : { supported: true, applied: false };
  }
  return changeForgejoConversationResolution(slug, item, "resolve");
}
