import type { FeedbackItemRef } from "./feedback-backend.js";
import { forgejoFetch, forgejoFetchList } from "./forgejo-cli.js";
import { groupReviewCommentConversations } from "./forgejo-conversations.js";
import { getForgejoViewer } from "./forgejo-environment.js";
import { forgejoReplyRoute, stripForgejoReplyPrefix } from "./forgejo-reply.js";
import { ForgejoIssueComment, ForgejoReview } from "./forgejo-schemas.js";
import type { ForgejoReviewComment } from "./forgejo-schemas.js";
import { stripThreadReplyMarker } from "./forgejo-thread-reply.js";
import { parseReviewServiceFinding } from "./review-service-finding.js";
import type { ServiceFinding } from "./review-service-finding.js";
import type { OwnReply } from "./select-reusable-reply.js";

export async function readForgejoServiceFinding(
  slug: string,
  item: FeedbackItemRef,
  comment: ForgejoReviewComment | undefined,
): Promise<ServiceFinding | undefined> {
  const reviewId = comment?.pull_request_review_id;
  if (item.type !== "thread" || comment === undefined || typeof reviewId !== "number") {
    return undefined;
  }
  const route = `repos/${slug}/pulls/${item.prNumber}/reviews/${reviewId}`;
  const raw = await forgejoFetch<unknown>({ path: route });
  if (raw === undefined) {
    throw new Error(`Forgejo GET ${route}: missing JSON response`);
  }
  return parseReviewServiceFinding(comment, ForgejoReview.parse(raw));
}

export async function listForgejoOwnReplies(
  slug: string,
  item: FeedbackItemRef,
  root: ForgejoReviewComment | undefined,
  reviewComments: readonly ForgejoReviewComment[],
): Promise<OwnReply[]> {
  if (item.type !== "thread" || root === undefined) {
    return [];
  }
  const viewer = await getForgejoViewer();
  if (forgejoReplyRoute(item, root).kind === "thread") {
    const conversation = groupReviewCommentConversations(reviewComments, viewer).find(
      (candidate) => candidate.root.id === root.id,
    );
    return (conversation?.replies ?? []).map((reply) => ({
      id: reply.id,
      url: reply.html_url,
      text: stripThreadReplyMarker(reply.body),
      createdAt: reply.created_at,
    }));
  }
  const comments = await forgejoFetchList<unknown>(
    `repos/${slug}/issues/${item.prNumber}/comments`,
  );
  return comments
    .map((raw) => ForgejoIssueComment.parse(raw))
    .flatMap((comment) => {
      const text = stripForgejoReplyPrefix(comment.body, item);
      return comment.user?.login === viewer && text !== undefined
        ? [{ id: comment.id, url: comment.html_url, text, createdAt: comment.created_at }]
        : [];
    });
}
