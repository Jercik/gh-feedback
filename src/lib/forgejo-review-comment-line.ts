/**
 * File line of an inline Forgejo review comment.
 *
 * Forgejo reports the new-side line in `position` and the old-side line in
 * `original_position`; the unused side is 0. Prefer whichever is set so a
 * comment on a removed line shows its real line instead of 0. Multi-line
 * comment positions store the start of the range; multi-line comments display
 * its final line by adding extra_lines_count, matching Forgejo's conversation UI.
 */

import type { Side } from "./feedback-types.js";
import type { ForgejoReviewComment } from "./forgejo-schemas.js";

export function reviewCommentLine(comment: ForgejoReviewComment): number | null {
  if ((comment.position ?? 0) <= 0 && (comment.original_position ?? 0) <= 0) {
    return null;
  }
  const displayLine = reviewCommentDisplayLine(comment);
  return displayLine === null || displayLine === 0 ? null : Math.abs(displayLine);
}

/** Signed display line used by Forgejo's native conversation grouping. */
export function reviewCommentDisplayLine(comment: ForgejoReviewComment): number | null {
  const newSide = comment.position ?? 0;
  const oldSide = comment.original_position ?? 0;
  const extraLines = comment.extra_lines_count ?? 0;
  if (
    newSide <= 0 &&
    oldSide <= 0 &&
    !(comment.position === 0 && comment.original_position === 0)
  ) {
    return null;
  }
  const coordinates = reviewCommentCoordinates(
    Math.max(newSide, 0),
    Math.max(oldSide, 0),
    extraLines,
  );
  return coordinates.side === "old" ? -coordinates.displayLine : coordinates.displayLine;
}

// Does not clamp inputs: snapshots pass raw integers, while reviewCommentDisplayLine validates
// native positions and clamps negative coordinates to zero before calling.
export function reviewCommentCoordinates(
  position: number,
  originalPosition: number,
  extraLines: number,
): { side: Side; displayLine: number } {
  let side: Side = "new";
  if (position === 0) {
    side = originalPosition === 0 ? "zero" : "old";
  }
  return { side, displayLine: (position === 0 ? originalPosition : position) + extraLines };
}

export function reviewCommentConversationIdentity(comment: ForgejoReviewComment): string | null {
  const signedLine = reviewCommentDisplayLine(comment);
  if (
    signedLine === null ||
    comment.pull_request_review_id === null ||
    comment.pull_request_review_id === undefined ||
    !comment.path
  ) {
    return null;
  }
  return [comment.pull_request_review_id, signedLine, comment.path].join("\u0000");
}
