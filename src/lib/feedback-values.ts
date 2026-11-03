import type {
  FindingState,
  FindingStatus,
  NullableFindingState,
  UserRef,
} from "./feedback-types.js";
import type { ReactionContent } from "./types.js";

export type ReactedStatus = Exclude<FindingStatus, "pending">;

export const statusReactions: Record<ReactedStatus, ReactionContent> = {
  "in-progress": "eyes",
  agreed: "+1",
  disagreed: "-1",
  acknowledged: "rocket",
  "awaiting-reply": "confused",
};

const finalStatuses = ["agreed", "disagreed", "acknowledged"] as const;

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

export const unfetchedFindingState: NullableFindingState = {
  viewerReactions: null,
  status: null,
  conflictingFinalReactions: false,
};

export function deriveStatus(viewerReactions: string[]): FindingState {
  const finals = finalStatuses.filter((status) =>
    viewerReactions.includes(statusReactions[status]),
  );
  if (finals.length > 1) {
    return { viewerReactions, status: "in-progress", conflictingFinalReactions: true };
  }
  const [final] = finals;
  if (final !== undefined) {
    return { viewerReactions, status: final, conflictingFinalReactions: false };
  }
  if (viewerReactions.includes(statusReactions["awaiting-reply"])) {
    return { viewerReactions, status: "awaiting-reply", conflictingFinalReactions: false };
  }
  if (viewerReactions.includes(statusReactions["in-progress"])) {
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
