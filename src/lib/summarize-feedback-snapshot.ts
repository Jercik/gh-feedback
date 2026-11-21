import type { FeedbackItem, FeedbackResponse } from "./summary-types.js";
import type { CommentRecord, IssueCommentRecord, PassSnapshot } from "./feedback-types.js";
import { isStatusDone, isStatusSettled } from "./summary-types.js";
import { isIgnoredAuthor } from "./feedback-environment.js";
import { stripThreadReplyMarker } from "./forgejo-thread-reply.js";
import { stripForgejoReplyMarker } from "./forgejo-reply.js";
import { isReviewBodyItem, mapCommentsToItems } from "./map-comments-to-items.js";

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
  const inlineReplies: CommentRecord[] = [];
  for (const { comment, resolved } of published) {
    if (comment.kind === "reply") {
      inlineReplies.push(comment);
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
  const replies = new Map<number, IssueCommentRecord & { kind: "reply" }>();
  for (const comment of snapshot.issueComments.records) {
    if (comment.kind === "reply") {
      replies.set(comment.id, comment);
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
  const itemIds = mapCommentsToItems(
    snapshot.reviews.records,
    published.map(({ comment }) => comment),
  );
  const itemAt = (commentId: number): SummaryItem | undefined =>
    byId.get(itemIds.get(commentId) ?? commentId);
  for (const reply of inlineReplies) {
    itemAt(reply.id)?.responses.push({
      author: reply.user.login ?? "ghost",
      timestamp: reply.createdAt ?? "",
      body: stripThreadReplyMarker(reply.body),
    });
  }
  const itemAnswering = (id: number, followed: Set<number>): SummaryItem => {
    const item = itemAt(id);
    if (item) {
      return item;
    }
    const reply = replies.get(id);
    if (reply === undefined || followed.has(id)) {
      throw new Error(`Snapshot reply chain through comment ${id} reaches no feedback item`);
    }
    followed.add(id);
    return itemAnswering(reply.replyTo, followed);
  };
  for (const reply of replies.values()) {
    itemAnswering(reply.replyTo, new Set([reply.id])).responses.push({
      author: reply.user.login ?? "ghost",
      timestamp: reply.createdAt ?? "",
      body: stripForgejoReplyMarker(reply.body),
    });
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
