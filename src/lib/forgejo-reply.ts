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

export async function postForgejoReply(
  slug: string,
  item: FeedbackItemRef,
  message: string,
  reviewComment: ForgejoReviewComment | undefined,
): Promise<ReplyResult> {
  const reviewId = reviewComment?.pull_request_review_id;
  if (
    item.type === "thread" &&
    reviewComment &&
    typeof reviewId === "number" &&
    hasThreadablePosition(reviewComment)
  ) {
    const threaded = await forgejoFetch<{ id: number; html_url: string }>({
      method: "POST",
      path: `repos/${slug}/pulls/${item.prNumber}/reviews/${reviewId}/comments`,
      body: forgejoThreadReplyBody(reviewComment, message),
    });
    return { id: threaded.id, url: threaded.html_url };
  }

  const issueComment = await forgejoFetch<{ id: number; html_url: string }>({
    method: "POST",
    path: `repos/${slug}/issues/${item.prNumber}/comments`,
    body: { body: forgejoReplyPrefix(item.type, item.id) + message },
  });
  return { id: issueComment.id, url: issueComment.html_url };
}
