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
 * `old_position`. This endpoint is a code-comment endpoint that always blames a
 * line, so a parent with neither side set has no line to thread under — callers
 * gate on `hasThreadablePosition` and fall back to a top-level reply instead.
 *
 * Matching anchors on the marker comment alone, ignoring the trailing
 * whitespace, so re-attachment survives Forgejo normalizing the stored body's
 * line endings (e.g. `\n\n` → `\r\n\r\n`) rather than hinging on a byte-exact
 * round-trip. Stripping removes only the marker and its blank-line separator, so
 * a reply message that intentionally begins with whitespace (e.g. an indented
 * code block) keeps its leading indentation.
 */

import type { ForgejoReviewComment } from "./forgejo-schemas.js";

const REPLY_PARENT_PREFIX = "<!-- gh-feedback:reply-to:";
const REPLY_PARENT_PATTERN = /^<!-- gh-feedback:reply-to:(?<parentId>\d+) -->/u;
const REPLY_PARENT_WITH_GAP = /^<!-- gh-feedback:reply-to:\d+ -->[ \t]*\r?\n\r?\n?/u;

/**
 * Whether a parent comment has a diff line a threaded reply can attach to.
 * Forgejo's create endpoint blames the line, erroring on a zero position, so a
 * positionless (file-level) parent must take the top-level reply path instead.
 */
export function hasThreadablePosition(comment: ForgejoReviewComment): boolean {
  return (comment.position ?? 0) > 0 || (comment.original_position ?? 0) > 0;
}

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
  if ((comment.extra_lines_count ?? 0) > 0) {
    body.extra_lines_count = comment.extra_lines_count ?? 0;
  }
  return body;
}

export function threadReplyParentId(body: string): number | undefined {
  const match = REPLY_PARENT_PATTERN.exec(body);
  if (!match?.[1]) {
    return undefined;
  }
  return Math.trunc(Number(match[1]));
}

export function stripThreadReplyMarker(body: string): string {
  return body.replace(REPLY_PARENT_WITH_GAP, "");
}
