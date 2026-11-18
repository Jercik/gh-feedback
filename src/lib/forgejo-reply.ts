/**
 * Posting replies to Forgejo feedback.
 *
 * Inline review comments thread natively: a reply POSTs into the parent's
 * review on the same line (reviews/{id}/comments) and nests under the original,
 * carrying an invisible parent-id marker (see forgejo-thread-reply) so the
 * summary re-attaches it to the exact comment it answered. Top-level PR comments,
 * review bodies, and inline comments with no diff position (the create endpoint
 * blames a line and rejects a zero position) have no line to thread under, so
 * replies to those post as PR issue comments prefixed with FORGEJO_REPLY_MARKER,
 * which the summary filters so a user's own reply never reappears as fresh
 * feedback.
 */

import type { FeedbackItemRef, ReplyResult } from "./feedback-backend.js";
import type { ForgejoReviewComment } from "./forgejo-schemas.js";
import { forgejoFetch } from "./forgejo-cli.js";
import { forgejoThreadReplyBody, hasThreadablePosition } from "./forgejo-thread-reply.js";

export const FORGEJO_REPLY_MARKER = "> Replying to ";

function forgejoReplyPrefix(itemType: FeedbackItemRef["type"], itemId: number): string {
  if (itemType === "thread") {
    return `${FORGEJO_REPLY_MARKER}review comment #${itemId}\n\n`;
  }
  if (itemType === "comment") {
    return `${FORGEJO_REPLY_MARKER}comment #${itemId}\n\n`;
  }
  return `${FORGEJO_REPLY_MARKER}review #${itemId}\n\n`;
}

export function stripForgejoReplyPrefix(
  body: string,
  item: Pick<FeedbackItemRef, "type" | "id">,
): string | undefined {
  const prefix = forgejoReplyPrefix(item.type, item.id);
  return body.startsWith(prefix) ? body.slice(prefix.length) : undefined;
}

type ForgejoReplyRoute =
  | { kind: "thread"; reviewId: number; reviewComment: ForgejoReviewComment }
  | { kind: "issue-comment" };

export function forgejoReplyRoute(
  item: Pick<FeedbackItemRef, "type">,
  reviewComment: ForgejoReviewComment | undefined,
): ForgejoReplyRoute {
  const reviewId = reviewComment?.pull_request_review_id;
  if (
    item.type === "thread" &&
    reviewComment !== undefined &&
    typeof reviewId === "number" &&
    hasThreadablePosition(reviewComment)
  ) {
    return { kind: "thread", reviewId, reviewComment };
  }
  return { kind: "issue-comment" };
}

export async function postForgejoReply(
  slug: string,
  item: FeedbackItemRef,
  message: string,
  reviewComment: ForgejoReviewComment | undefined,
): Promise<ReplyResult> {
  const route = forgejoReplyRoute(item, reviewComment);
  let path: string;
  let body: Record<string, string | number>;
  if (route.kind === "thread") {
    path = `repos/${slug}/pulls/${item.prNumber}/reviews/${route.reviewId}/comments`;
    body = forgejoThreadReplyBody(route.reviewComment, message);
  } else {
    path = `repos/${slug}/issues/${item.prNumber}/comments`;
    body = { body: forgejoReplyPrefix(item.type, item.id) + message };
  }

  const reply = await forgejoFetch<{ id: number; html_url: string }>({
    method: "POST",
    path,
    body,
  });
  if (reply === undefined) {
    throw new Error(
      `Forgejo POST ${path}: missing JSON reply response; the reply may already exist`,
    );
  }
  return { id: reply.id, url: reply.html_url };
}
