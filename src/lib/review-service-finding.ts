import { isForgejoActionsUser } from "./forgejo-actions-identity.js";

const ULID = "[0-9A-HJKMNP-TV-Z]{26}";

const claimMarker = new RegExp(`^<!-- review:claim:(?<claim>${ULID}) -->\\r?\\n`, "u");
const identityLine = new RegExp(
  `^claim \`(?<claim>${ULID})\` of review \`(?<review>${ULID})\`$`,
  "mu",
);

export interface ServiceFinding {
  claimId: string;
  reviewId: string;
  path: string;
}

interface AuthoredByUser {
  user?: { id?: number | null | undefined } | null | undefined;
}

export function parseReviewServiceFinding(
  comment: AuthoredByUser & { body: string; path?: string | null | undefined },
  review: AuthoredByUser & { state: string },
): ServiceFinding | undefined {
  if (
    !isForgejoActionsUser(comment.user) ||
    !isForgejoActionsUser(review.user) ||
    review.state === "PENDING" ||
    !comment.path
  ) {
    return undefined;
  }
  const claimId = claimMarker.exec(comment.body)?.groups?.claim;
  const identity = identityLine.exec(comment.body)?.groups;
  if (claimId === undefined || identity?.claim !== claimId || identity.review === undefined) {
    return undefined;
  }
  return { claimId, reviewId: identity.review, path: comment.path };
}
