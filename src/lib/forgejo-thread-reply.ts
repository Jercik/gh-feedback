/**
 * Build and recognize threaded replies to a Forgejo inline review comment
 * (POST reviews/{id}/comments).
 *
 * Forgejo has no per-comment parent link, so the tool stamps each reply it posts
 * with an HTML-comment marker carrying the parent comment id. The marker is
 * invisible in rendered Markdown but lets the summary re-attach a reply to the
 * exact comment it answered — and drop it when that comment is gone — instead of
 * inferring the parent from the line position, which can't tell two distinct
 * findings on one line apart. Positions are still sent so Forgejo threads the
 * reply in its own UI: the new-side line goes in `new_position`, the old-side in
 * `old_position`, and a comment with neither set carries only the path so
 * Forgejo attaches it to the file-level conversation.
 */

import type { ForgejoReviewComment } from "./forgejo-schemas.js";

const REPLY_PARENT_PREFIX = "<!-- gh-feedback:reply-to:";
const REPLY_PARENT_PATTERN = /^<!-- gh-feedback:reply-to:(\d+) -->\n\n/u;

export function forgejoThreadReplyBody(
  comment: ForgejoReviewComment,
  message: string,
): Record<string, string | number> {
  const marked = `${REPLY_PARENT_PREFIX}${comment.id} -->\n\n${message}`;
  const body: Record<string, string | number> = { body: marked, path: comment.path ?? "" };
  const newSide = comment.position ?? 0;
  const oldSide = comment.original_position ?? 0;
  if (newSide > 0) {
    body.new_position = newSide;
  } else if (oldSide > 0) {
    body.old_position = oldSide;
  }
  return body;
}

export function threadReplyParentId(body: string): number | undefined {
  const match = REPLY_PARENT_PATTERN.exec(body);
  if (!match?.[1]) {
    return undefined;
  }
  return Number.parseInt(match[1], 10);
}

export function stripThreadReplyMarker(body: string): string {
  return body.replace(REPLY_PARENT_PATTERN, "");
}
