import type { FeedbackItem, FeedbackResponse } from "./summary-types.js";
import type { IssueCommentRecord, PassSnapshot } from "./feedback-types.js";
import { isStatusDone, isStatusSettled } from "./summary-types.js";
import { isIgnoredAuthor } from "./feedback-environment.js";
import { stripThreadReplyMarker } from "./forgejo-thread-reply.js";
import { parseForgejoIssueCommentReply } from "./forgejo-reply.js";

type SummaryItem = FeedbackItem & { responses: FeedbackResponse[] };

export function summarizeFeedbackSnapshot(
  snapshot: Pick<PassSnapshot, "reviews" | "conversations" | "issueComments"> & { viewer: string },
  hideResolved: boolean,
): FeedbackItem[] {
  const candidates: { item: SummaryItem; resolved: boolean; inline: boolean }[] = [];
  const byId = new Map<number, SummaryItem>();
  for (const review of snapshot.reviews.records) {
    if (review.unpublished || review.body.trim() === "") {
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
      const root = comment.replyTo === null ? undefined : byId.get(comment.replyTo);
      if (root) {
        root.responses.push({
          author: comment.user.login ?? "ghost",
          timestamp: comment.createdAt ?? "",
          body: stripThreadReplyMarker(comment.body),
        });
        byId.set(comment.id, root);
      }
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
  const issueComments = new Map(snapshot.issueComments.records.map((c) => [c.id, c]));
  const ownerOf = new Map<number, SummaryItem>();
  const resolve = (comment: IssueCommentRecord, visiting: Set<number>): SummaryItem => {
    const known = ownerOf.get(comment.id);
    if (known) {
      return known;
    }
    visiting.add(comment.id);
    const reply =
      comment.user.login === snapshot.viewer
        ? parseForgejoIssueCommentReply(comment.body)
        : undefined;
    const target = reply && issueComments.get(reply.targetId);
    let root: SummaryItem | undefined;
    if (reply && target) {
      root = visiting.has(target.id) ? undefined : resolve(target, visiting);
    } else if (reply) {
      root = byId.get(reply.targetId);
    }
    let owner: SummaryItem;
    if (reply && root) {
      root.responses.push({
        author: comment.user.login ?? "ghost",
        timestamp: comment.createdAt ?? "",
        body: reply.text,
      });
      owner = root;
    } else {
      owner = {
        id: comment.id,
        timestamp: comment.createdAt ?? "",
        status: comment.status,
        author: comment.user.login ?? "ghost",
        location: "",
        body: comment.body,
        responses: [],
      };
      candidates.push({ item: owner, resolved: false, inline: false });
    }
    ownerOf.set(comment.id, owner);
    return owner;
  };
  for (const comment of snapshot.issueComments.records) {
    resolve(comment, new Set());
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
