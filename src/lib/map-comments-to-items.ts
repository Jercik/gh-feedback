import type { ClassifiedIssueComment, CommentRecord, ReviewRecord } from "./feedback-types.js";

export function isReviewBodyItem(review: ReviewRecord): boolean {
  return !review.unpublished && review.body.trim() !== "";
}

export function mapCommentsToItems(
  reviews: readonly ReviewRecord[],
  inlineComments: readonly CommentRecord[],
  issueComments: readonly ClassifiedIssueComment[],
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
  const replyTargets = new Map<number, number>();
  for (const comment of issueComments) {
    if (comment.kind === "finding") {
      itemIds.set(comment.id, comment.id);
    } else {
      replyTargets.set(comment.id, comment.replyTo);
    }
  }
  const itemAnswering = (id: number, followed: Set<number>): number => {
    const itemId = itemIds.get(id);
    if (itemId !== undefined) {
      return itemId;
    }
    const target = replyTargets.get(id);
    if (target === undefined || followed.has(id)) {
      throw new Error(`Snapshot reply chain through comment ${id} reaches no feedback item`);
    }
    followed.add(id);
    return itemAnswering(target, followed);
  };
  for (const id of replyTargets.keys()) {
    itemIds.set(id, itemAnswering(id, new Set()));
  }
  return itemIds;
}
