import type { FeedbackItem, FeedbackSummary } from "./summary-types.js";
import type { SummaryOptions } from "./feedback-backend.js";
import { fetchFeedbackSnapshot } from "./feedback-snapshot.js";
import { isStatusDone, isStatusSettled } from "./summary-types.js";
import { isIgnoredAuthor } from "./feedback-environment.js";
import { stripThreadReplyMarker } from "./forgejo-thread-reply.js";
import { FORGEJO_REPLY_MARKER } from "./forgejo-reply.js";

export async function buildSummary(
  slug: string,
  prNumber: number,
  options: SummaryOptions = {},
): Promise<FeedbackSummary> {
  const snapshot = await fetchFeedbackSnapshot(slug, prNumber);
  if (!snapshot.stable) {
    throw new Error(
      "Feedback changed between complete passes; rerun summary or inspect snapshot (exit 3).",
    );
  }
  const items: FeedbackItem[] = [];
  const add = (item: FeedbackItem, resolved = false, inline = false): void => {
    if (item.body.trim() === "" || isIgnoredAuthor(item.author)) {
      return;
    }
    if (
      options.hideResolved &&
      (resolved || (inline ? isStatusSettled(item.status) : isStatusDone(item.status)))
    ) {
      return;
    }
    items.push(item);
  };
  for (const review of snapshot.reviews.records) {
    if (review.unpublished || review.body.trim() === "") {
      continue;
    }
    add({
      id: review.backingCommentId,
      actionable: review.backingCommentId !== null,
      reviewId: review.id,
      timestamp: review.submittedAt ?? "",
      status: review.status ?? "pending",
      author: review.user.login ?? "ghost",
      location: "",
      body: review.body,
      responses: [],
    });
  }
  const byId = new Map<number, FeedbackItem>();
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
      const root = comment.replyTo === null ? undefined : byId.get(comment.replyTo);
      if (root) {
        (root.responses as { author: string; timestamp: string; body: string }[]).push({
          author: comment.user.login ?? "ghost",
          timestamp: comment.createdAt ?? "",
          body: stripThreadReplyMarker(comment.body),
        });
        byId.set(comment.id, root);
      }
      continue;
    }
    const item: FeedbackItem = {
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
    add(item, resolved, true);
  }
  for (const comment of snapshot.issueComments.records) {
    if (comment.user.login === snapshot.viewer && comment.body.startsWith(FORGEJO_REPLY_MARKER)) {
      continue;
    }
    add({
      id: comment.id,
      timestamp: comment.createdAt ?? "",
      status: comment.status,
      author: comment.user.login ?? "ghost",
      location: "",
      body: comment.body,
      responses: [],
    });
  }
  return {
    prNumber,
    prUrl: snapshot.pull.html_url,
    prTitle: snapshot.pull.title,
    items: items.toSorted((a, b) => a.timestamp.localeCompare(b.timestamp)),
  };
}
