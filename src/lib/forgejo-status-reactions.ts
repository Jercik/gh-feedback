/**
 * Reactions that back a feedback item's workflow status.
 *
 * A review comment's status reaction can sit on the conversation root or any of
 * its replies, and the user may target either id, so its status is read from the
 * whole conversation — matching summary and detail. Other kinds have no thread,
 * so the item's own id suffices.
 */

import type { FeedbackItemRef } from "./feedback-backend.js";
import type { ForgejoItemMeta } from "./forgejo-item.js";
import type { ForgejoReaction } from "./forgejo-schemas.js";
import { fetchReactions, fetchConversationReactions } from "./forgejo-reactions.js";
import { fetchPullReviewComments } from "./forgejo-pull-review-comments.js";
import { groupReviewCommentConversations, findConversationFor } from "./forgejo-conversations.js";

export async function fetchStatusReactions(
  slug: string,
  item: FeedbackItemRef,
  meta: ForgejoItemMeta,
  viewer: string,
): Promise<ForgejoReaction[]> {
  if (meta.kind !== "review-comment") {
    return fetchReactions(slug, meta.kind, item.id);
  }
  const conversations = groupReviewCommentConversations(
    await fetchPullReviewComments(slug, item.prNumber),
    viewer,
  );
  const conversation = findConversationFor(conversations, item.id);
  const ids = conversation
    ? [conversation.root.id, ...conversation.replies.map((r) => r.id)]
    : [item.id];
  return fetchConversationReactions(slug, ids);
}
