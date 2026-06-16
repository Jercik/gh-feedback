/**
 * Forgejo item detail: full untruncated content for a single feedback item.
 *
 * Forgejo has no thread-resolve or outdated axis, so threads always report
 * isResolved/isOutdated false and reviews report a fixed COMMENTED state.
 */

import type { ItemDetail } from "./fetch-item-detail.js";
import { resolveItemMeta } from "./forgejo-item.js";
import { fetchReactions, toReactionSummary } from "./forgejo-reactions.js";
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
    const c = resolved.reviewComment;
    const reactions = await fetchReactions(slug, "review-comment", c.id);
    return {
      type: "thread",
      id: c.id,
      path: c.path ?? null,
      line: c.position ?? null,
      isOutdated: false,
      isResolved: false,
      comments: [
        {
          id: c.id,
          author: c.user?.login ?? "ghost",
          body: c.body,
          createdAt: c.created_at,
          reactions: toReactionSummary(reactions),
        },
      ],
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
