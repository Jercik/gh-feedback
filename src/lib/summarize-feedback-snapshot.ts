import type { FeedbackItem, FeedbackResponse } from "./summary-types.js";
import type { PassSnapshot } from "./feedback-types.js";
import { isStatusDone, isStatusSettled } from "./summary-types.js";
import { isIgnoredAuthor } from "./feedback-environment.js";
import { collectItemReplies } from "./collect-item-replies.js";
import { isReviewBodyItem } from "./map-comments-to-items.js";

type SummaryItem = FeedbackItem & { responses: FeedbackResponse[] };

export function summarizeFeedbackSnapshot(
  snapshot: Pick<PassSnapshot, "reviews" | "conversations" | "issueComments">,
  hideResolved: boolean,
): FeedbackItem[] {
  const candidates: { item: SummaryItem; resolved: boolean; inline: boolean }[] = [];
  const byId = new Map<number, SummaryItem>();
  for (const review of snapshot.reviews.records) {
    if (!isReviewBodyItem(review)) {
      continue;
    }
    const item: SummaryItem = {
      id: review.backingCommentId,
      actionable: review.backingCommentId !== null,
      reviewId: review.id,
      timestamp: review.submittedAt ?? "",
      status: review.status ?? "pending",
      author: review.user.login ?? "ghost",
      location: "",
      body: review.body,
      responses: [],
    };
    if (review.backingCommentId !== null) {
      byId.set(review.backingCommentId, item);
    }
    candidates.push({ item, resolved: false, inline: false });
  }
  const published = snapshot.conversations
    .flatMap((conversation) =>
      conversation.comments.map((comment) => ({
        comment,
        resolved: conversation.resolver !== null,
      })),
    )
    .toSorted((a, b) => a.comment.id - b.comment.id);
  for (const { comment, resolved } of published) {
    if (comment.kind === "reply") {
      continue;
    }
    const item: SummaryItem = {
      id: comment.id,
      timestamp: comment.createdAt ?? "",
      status:
        resolved && (comment.status === null || !isStatusDone(comment.status))
          ? "in-progress"
          : (comment.status ?? "pending"),
      author: comment.user.login ?? "ghost",
      location: comment.path ? `${comment.path}:${comment.displayLine}` : "",
      body: comment.body,
      responses: [],
    };
    byId.set(comment.id, item);
    candidates.push({ item, resolved, inline: true });
  }
  for (const comment of snapshot.issueComments.records) {
    if (comment.kind === "reply") {
      continue;
    }
    const item: SummaryItem = {
      id: comment.id,
      timestamp: comment.createdAt ?? "",
      status: comment.status,
      author: comment.user.login ?? "ghost",
      location: "",
      body: comment.body,
      responses: [],
    };
    byId.set(comment.id, item);
    candidates.push({ item, resolved: false, inline: false });
  }
  for (const [itemId, replies] of collectItemReplies(snapshot).repliesByItem) {
    for (const reply of [...replies.threadReplies, ...replies.prCommentReplies]) {
      byId.get(itemId)?.responses.push({
        author: reply.author,
        timestamp: reply.createdAt ?? "",
        body: reply.body,
      });
    }
  }
  return candidates
    .filter(
      ({ item, resolved, inline }) =>
        item.body.trim() !== "" &&
        !isIgnoredAuthor(item.author) &&
        !(
          hideResolved &&
          (resolved || (inline ? isStatusSettled(item.status) : isStatusDone(item.status)))
        ),
    )
    .map(({ item }) => ({
      ...item,
      responses: item.responses.toSorted((a, b) => a.timestamp.localeCompare(b.timestamp)),
    }))
    .toSorted((a, b) => a.timestamp.localeCompare(b.timestamp));
}
