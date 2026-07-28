import { spawnSync } from "node:child_process";
import type { CapabilityResult, FeedbackItemRef } from "./feedback-backend.js";
import type { FeedbackOutcome } from "./feedback-backend.js";
import { forgejoApiHost, getFgjBinaryPath } from "./forgejo-cli.js";

const FORGEJO_UNSUPPORTED_HIDE =
  "Forgejo has no comment-hide API; status is tracked by reaction only.";

type ForgejoResolutionAction = "resolve" | "unresolve";

export function isForgejoResolutionUnsupported(message: string): boolean {
  return message.split(/\r?\n/u).some((rawLine) => {
    const line = rawLine
      .trim()
      .toLowerCase()
      .replace(/^error:\s*/u, "");
    return (
      /^(?:this forgejo instance has )?no conversation-?resolution api\b/u.test(line) ||
      /^(?:unknown command|unrecognized subcommand)\b/u.test(line) ||
      /^accepts 1 arg\(s\), received 3$/u.test(line)
    );
  });
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
  resolvedByAnyone: boolean,
  readyToResolve: boolean,
): CapabilityResult {
  if (item.type !== "thread") {
    return { supported: false, reason: FORGEJO_UNSUPPORTED_HIDE };
  }
  if (outcome === "disagreed") {
    if (resolvedByViewer) {
      return changeForgejoConversationResolution(slug, item, "unresolve");
    }
    return resolvedByAnyone
      ? {
          supported: true,
          applied: false,
          reason: "conversation resolution belongs to another user and was preserved",
        }
      : { supported: true, applied: false, reason: "conversation was already open" };
  }
  if (!readyToResolve) {
    return {
      supported: true,
      applied: false,
      reason: "conversation resolution deferred until its other findings settle",
    };
  }
  if (resolvedByAnyone) {
    return { supported: true, applied: false, reason: "conversation was already resolved" };
  }
  return changeForgejoConversationResolution(slug, item, "resolve");
}
