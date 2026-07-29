import type { CapabilityResult, FeedbackItemRef } from "./feedback-backend.js";
import type { FeedbackOutcome } from "./feedback-backend.js";

const FORGEJO_UNSUPPORTED_HIDE =
  "Forgejo has no comment-hide API; status is tracked by reaction only.";

export type ForgejoResolutionAction = "resolve" | "unresolve";

type ForgejoCompletionDecision = CapabilityResult | { action: ForgejoResolutionAction };

const OLD_FGJ_RESOLUTION_REASON =
  "installed fgj does not support conversation resolution; install the j4k build v0.5.0-j4k.4 or newer";

export function forgejoResolutionUnsupportedReason(message: string): string | undefined {
  let unsupportedReason: string | undefined;
  for (const rawLine of message.split(/\r?\n/u)) {
    const displayLine = rawLine.trim().replace(/^error:\s*/iu, "");
    const line = displayLine.toLowerCase();
    // Pre-j4k.4 builds emit these exact Cobra 1.8.1 errors for this fixed argv shape.
    if (/^unknown flag:\s*--json$/u.test(line) || /^accepts 1 arg\(s\), received 3$/u.test(line)) {
      return OLD_FGJ_RESOLUTION_REASON;
    }
    if (/^(?:unknown command|unrecognized subcommand)\b/u.test(line)) {
      return OLD_FGJ_RESOLUTION_REASON;
    }
    if (/^(?:this forgejo instance has )?no conversation-?resolution api\b/u.test(line)) {
      unsupportedReason = displayLine;
    }
  }
  return unsupportedReason;
}

export function isForgejoConversationResolvedBy(
  resolver: { login: string } | null | undefined,
  viewer: string,
): boolean {
  return resolver?.login === viewer;
}

export function forgejoCompletionNeedsReadiness(
  item: FeedbackItemRef,
  outcome: FeedbackOutcome,
  resolvedByAnyone: boolean,
): boolean {
  return item.type === "thread" && outcome !== "disagreed" && !resolvedByAnyone;
}

export function decideForgejoReopen(
  item: FeedbackItemRef,
  resolvedByViewer: boolean,
  resolvedByAnyone: boolean,
): ForgejoCompletionDecision {
  if (item.type !== "thread") {
    return { supported: false, reason: FORGEJO_UNSUPPORTED_HIDE };
  }
  if (resolvedByViewer) {
    return { action: "unresolve" };
  }
  return resolvedByAnyone
    ? {
        supported: true,
        applied: false,
        reason: "conversation resolution belongs to another user and was preserved",
      }
    : { supported: true, applied: true };
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
    // JSON makes fgj reject malformed success bodies and exposes pre-j4k.4 builds through their unknown-flag error.
    "--json",
  ];
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
    return decideForgejoReopen(item, resolvedByViewer, resolvedByAnyone);
  }
  if (resolvedByAnyone) {
    return { supported: true, applied: true };
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
