import type { CommentRecord, ReviewRecord } from "./feedback-types.js";

export function isReviewBodyItem(review: ReviewRecord): boolean {
  return !review.unpublished && review.body.trim() !== "";
}

export function mapCommentsToItems(
  reviews: readonly ReviewRecord[],
  inlineComments: readonly CommentRecord[],
): Map<number, number> {
  const itemIds = new Map<number, number>();
  for (const review of reviews) {
    if (isReviewBodyItem(review) && review.backingCommentId !== null) {
      itemIds.set(review.backingCommentId, review.backingCommentId);
    }
  }
  for (const comment of inlineComments.toSorted((a, b) => a.id - b.id)) {
    if (comment.kind === "finding") {
      itemIds.set(comment.id, comment.id);
      continue;
    }
    const itemId = comment.replyTo === null ? undefined : itemIds.get(comment.replyTo);
    if (itemId !== undefined) {
      itemIds.set(comment.id, itemId);
    }
  }
  return itemIds;
}
