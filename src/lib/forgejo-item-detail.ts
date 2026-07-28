/**
 * Forgejo item detail: full untruncated content for a single feedback item.
 *
 * The j4k Forgejo fork exposes the inline conversation resolver. Forgejo still
 * has no outdated axis, and reviews report a fixed COMMENTED state.
 */

import type { ItemDetail } from "./fetch-item-detail.js";
import { resolveItemMeta } from "./forgejo-item.js";
import { fetchReactions, toReactionSummary } from "./forgejo-reactions.js";
import { reviewCommentLine } from "./forgejo-review-comment-line.js";
import { groupReviewCommentConversations, findConversationFor } from "./forgejo-conversations.js";
import { stripThreadReplyMarker } from "./forgejo-thread-reply.js";
import { getForgejoViewer } from "./forgejo-environment.js";
import { exitWithMessage } from "./git-helpers.js";

export async function buildItemDetail(
  slug: string,
  prNumber: number,
  itemId: number,
): Promise<ItemDetail> {
  const resolved = await resolveItemMeta(slug, prNumber, itemId);
  if (!resolved) {
    return exitWithMessage(`Error: Could not find item #${itemId} in Forgejo PR #${prNumber}.`);
  }

  if (resolved.reviewComment) {
    const target = resolved.reviewComment;
    // Group the whole PR's review comments (already fetched while resolving the
    // id) so detail returns every comment in the conversation — matching summary's
    // grouping and the GitHub thread path — rather than just the root. The id may
    // be a reply, so match it on either side.
    const viewer = await getForgejoViewer();
    const conversations = groupReviewCommentConversations(resolved.reviewComments ?? [], viewer);
    const conversation = findConversationFor(conversations, target.id);
    const members = conversation ? [conversation.root, ...conversation.replies] : [target];
    const root = conversation?.root ?? target;

    const comments = await Promise.all(
      members.map(async (m) => ({
        id: m.id,
        author: m.user?.login ?? "ghost",
        body: stripThreadReplyMarker(m.body),
        createdAt: m.created_at,
        reactions: toReactionSummary(await fetchReactions(slug, "review-comment", m.id)),
      })),
    );

    return {
      type: "thread",
      id: root.id,
      path: root.path ?? null,
      line: reviewCommentLine(root),
      isOutdated: false,
      isResolved: Boolean(root.resolver),
      comments,
    };
  }

  if (resolved.issueComment) {
    const c = resolved.issueComment;
    const reactions = await fetchReactions(slug, "issue-comment", c.id);
    return {
      type: "comment",
      id: c.id,
      author: c.user?.login ?? "ghost",
      url: c.html_url,
      createdAt: c.created_at,
      body: c.body,
      reactions: toReactionSummary(reactions),
    };
  }

  const review = resolved.review;
  if (review) {
    return {
      type: "review",
      id: review.id,
      author: review.user?.login ?? "ghost",
      state: "COMMENTED",
      url: review.html_url ?? "",
      submittedAt: review.submitted_at,
      body: review.body,
      reactions: [],
    };
  }

  return exitWithMessage(`Error: Could not resolve detail for item #${itemId}.`);
}
