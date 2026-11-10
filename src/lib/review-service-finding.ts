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

type FindingComment = AuthoredByUser & { body: string; path?: string | null | undefined };

export function parseReviewServiceFinding(
  comment: FindingComment,
  review: AuthoredByUser & { state: string },
): ServiceFinding | undefined {
  if (!isForgejoActionsUser(review.user) || review.state === "PENDING") {
    return undefined;
  }
  return parseServiceFindingComment(comment);
}

// Reads the claim from the comment alone; the review's author and state are not checked.
export function parseServiceFindingComment(comment: FindingComment): ServiceFinding | undefined {
  if (!isForgejoActionsUser(comment.user) || !comment.path) {
    return undefined;
  }
  const claimId = claimMarker.exec(comment.body)?.groups?.claim;
  const identity = identityLine.exec(comment.body)?.groups;
  if (claimId === undefined || identity?.claim !== claimId || identity.review === undefined) {
    return undefined;
  }
  return { claimId, reviewId: identity.review, path: comment.path };
}
