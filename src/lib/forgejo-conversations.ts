/**
 * Group flat Forgejo review comments into line conversations.
 *
 * Forgejo exposes no per-comment parent link and threads inline comments by
 * line, yet two independent reviews can comment on the SAME line. A reply
 * posted via reviews/{id}/comments inherits its parent's review id, so the
 * conversation key is (reviewId, path, position, originalPosition): co-located
 * comments from different reviews stay distinct findings, while a reply nests
 * under the comment it answered. The earliest comment by id is the root; later
 * ones are replies. A comment missing a review id or path can't be threaded, so
 * it keys to itself and stands alone.
 */

import type { ForgejoReviewComment } from "./forgejo-schemas.js";

function conversationKey(comment: ForgejoReviewComment): string {
  if (typeof comment.pull_request_review_id !== "number" || typeof comment.path !== "string") {
    return `solo:${comment.id}`;
  }
  return [
    comment.pull_request_review_id,
    comment.path,
    comment.position ?? 0,
    comment.original_position ?? 0,
  ].join("\n");
}

export function groupReviewCommentConversations(
  comments: readonly ForgejoReviewComment[],
): { root: ForgejoReviewComment; replies: ForgejoReviewComment[] }[] {
  const groups = new Map<string, ForgejoReviewComment[]>();
  const order: string[] = [];

  for (const comment of [...comments].toSorted((a, b) => a.id - b.id)) {
    const key = conversationKey(comment);
    const existing = groups.get(key);
    if (existing) {
      existing.push(comment);
      continue;
    }
    groups.set(key, [comment]);
    order.push(key);
  }

  return order.flatMap((key) => {
    const members = groups.get(key) ?? [];
    const root = members[0];
    return root ? [{ root, replies: members.slice(1) }] : [];
  });
}
