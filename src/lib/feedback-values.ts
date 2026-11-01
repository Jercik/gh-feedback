import { asRecord } from "./forgejo-json-values.js";
import type { FindingStatus, UserRef } from "./feedback-types.js";

const finalReactionStatuses = new Map<string, FindingStatus>([
  ["+1", "agreed"],
  ["-1", "disagreed"],
  ["rocket", "acknowledged"],
]);

export function integerOrZero(value: unknown): number {
  return typeof value === "number" && Number.isInteger(value) ? value : 0;
}

export function userRef(value: unknown): UserRef | null {
  const record = asRecord(value);
  if (record === null) {
    return null;
  }
  const id = record.id;
  const login = record.login;
  return {
    id: typeof id === "number" ? id : null,
    login: typeof login === "string" ? login : null,
  };
}

export function deriveStatus(viewerReactions: string[]): {
  status: FindingStatus;
  conflictingFinalReactions: boolean;
} {
  const finals = [...new Set(viewerReactions)].filter((content) =>
    finalReactionStatuses.has(content),
  );
  if (finals.length > 1) {
    return { status: "in-progress", conflictingFinalReactions: true };
  }
  const final = finals[0] === undefined ? undefined : finalReactionStatuses.get(finals[0]);
  if (final !== undefined) {
    return { status: final, conflictingFinalReactions: false };
  }
  if (viewerReactions.includes("confused")) {
    return { status: "awaiting-reply", conflictingFinalReactions: false };
  }
  if (viewerReactions.includes("eyes")) {
    return { status: "in-progress", conflictingFinalReactions: false };
  }
  return { status: "pending", conflictingFinalReactions: false };
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
