/**
 * Build the request body for a threaded reply to a Forgejo inline review
 * comment (POST reviews/{id}/comments).
 *
 * Forgejo takes the new-side line in `new_position` and the old-side line in
 * `old_position`; replying on the parent comment's side drops the reply into
 * the same line conversation. A comment with neither side set carries only the
 * path, letting Forgejo attach it to the file-level conversation.
 */

import type { ForgejoReviewComment } from "./forgejo-schemas.js";

export function forgejoThreadReplyBody(
  comment: ForgejoReviewComment,
  message: string,
): Record<string, string | number> {
  const body: Record<string, string | number> = { body: message, path: comment.path ?? "" };
  const newSide = comment.position ?? 0;
  const oldSide = comment.original_position ?? 0;
  if (newSide > 0) {
    body.new_position = newSide;
  } else if (oldSide > 0) {
    body.old_position = oldSide;
  }
  return body;
}
