/**
 * Resolve an inline review comment id to its conversation root.
 *
 * A thread's status belongs on the finding — the conversation root — so commands
 * canonicalize whatever id the user targeted (the root, or a reply id copied
 * from a printed reply URL) to the root before reading or writing reactions.
 * That keeps status reads and writes on the same comment. Operates on an
 * already-fetched comment list so the caller pays the fan-out once. Returns
 * undefined when the id isn't among them, so the caller keeps the original id.
 */

import type { ForgejoReviewComment } from "./forgejo-schemas.js";
import { groupReviewCommentConversations, findConversationFor } from "./forgejo-conversations.js";

export function conversationRootOf(
  comments: readonly ForgejoReviewComment[],
  itemId: number,
  viewer: string,
): ForgejoReviewComment | undefined {
  const conversations = groupReviewCommentConversations(comments, viewer);
  return findConversationFor(conversations, itemId)?.root;
}
