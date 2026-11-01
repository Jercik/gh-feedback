import type { FindingState, FindingStatus, UserRef } from "./feedback-types.js";

const finalReactionStatuses = new Map<string, FindingStatus>([
  ["+1", "agreed"],
  ["-1", "disagreed"],
  ["rocket", "acknowledged"],
]);

export function integerOrZero(value: unknown): number {
  return typeof value === "number" && Number.isInteger(value) ? value : 0;
}

export function userRef(
  value: { id?: number | null; login: string } | null | undefined,
): UserRef | null {
  return value === null || value === undefined
    ? null
    : { id: value.id ?? null, login: value.login };
}

interface UnavailableReactionStatus {
  viewerReactions: null;
  status: null;
  conflictingFinalReactions: false;
}
export function deriveStatus(viewerReactions: null): UnavailableReactionStatus;
export function deriveStatus(viewerReactions: string[]): FindingState;
export function deriveStatus(
  viewerReactions: string[] | null,
): FindingState | UnavailableReactionStatus {
  if (viewerReactions === null) {
    return { viewerReactions, status: null, conflictingFinalReactions: false };
  }
  const finals = [...new Set(viewerReactions)].filter((content) =>
    finalReactionStatuses.has(content),
  );
  if (finals.length > 1) {
    return { viewerReactions, status: "in-progress", conflictingFinalReactions: true };
  }
  const final = finals[0] === undefined ? undefined : finalReactionStatuses.get(finals[0]);
  if (final !== undefined) {
    return { viewerReactions, status: final, conflictingFinalReactions: false };
  }
  if (viewerReactions.includes("confused")) {
    return { viewerReactions, status: "awaiting-reply", conflictingFinalReactions: false };
  }
  if (viewerReactions.includes("eyes")) {
    return { viewerReactions, status: "in-progress", conflictingFinalReactions: false };
  }
  return { viewerReactions, status: "pending", conflictingFinalReactions: false };
}

export function parseBackingCommentId(htmlUrl: string | null): number | null {
  if (htmlUrl === null) {
    return null;
  }
  const commentId = /#issuecomment-(?<commentId>\d+)$/u.exec(htmlUrl)?.groups?.commentId;
  if (commentId === undefined) {
    return null;
  }
  return Number(commentId);
}
