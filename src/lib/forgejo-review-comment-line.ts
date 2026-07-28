/**
 * File line of an inline Forgejo review comment.
 *
 * Forgejo reports the new-side line in `position` and the old-side line in
 * `original_position`; the unused side is 0. Prefer whichever is set so a
 * comment on a removed line shows its real line instead of 0. Multi-line
 * comments display the end of their range, matching Forgejo's conversation UI.
 */

import type { ForgejoReviewComment } from "./forgejo-schemas.js";

export function reviewCommentLine(comment: ForgejoReviewComment): number | null {
  const displayLine = reviewCommentDisplayLine(comment);
  return displayLine === null ? null : Math.abs(displayLine);
}

/** Signed display line used by Forgejo's native conversation grouping. */
export function reviewCommentDisplayLine(comment: ForgejoReviewComment): number | null {
  const newSide = comment.position ?? 0;
  const oldSide = comment.original_position ?? 0;
  const extraLines = comment.extra_lines_count ?? 0;
  if (newSide > 0) {
    return newSide + extraLines;
  }
  if (oldSide > 0) {
    return -(oldSide + extraLines);
  }
  return null;
}
