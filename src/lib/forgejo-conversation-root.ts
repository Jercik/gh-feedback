/**
 * Resolve an inline review comment id to its conversation root.
 *
 * A thread's status belongs on the finding — the conversation root — so commands
 * canonicalize whatever id the user targeted (the root, or a reply id copied
 * from a printed reply URL) to the root before reading or writing reactions.
 * That keeps status reads and writes on the same comment. Returns undefined when
 * the id isn't an inline review comment, so the caller keeps the original id.
 */

import type { ForgejoReviewComment } from "./forgejo-schemas.js";
import { fetchPullReviewComments } from "./forgejo-pull-review-comments.js";
import { groupReviewCommentConversations, findConversationFor } from "./forgejo-conversations.js";

export async function resolveConversationRoot(
  slug: string,
  prNumber: number,
  itemId: number,
  viewer: string,
): Promise<ForgejoReviewComment | undefined> {
  const conversations = groupReviewCommentConversations(
    await fetchPullReviewComments(slug, prNumber),
    viewer,
  );
  return findConversationFor(conversations, itemId)?.root;
}
