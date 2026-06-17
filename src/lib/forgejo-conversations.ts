/**
 * Group flat Forgejo review comments into line conversations.
 *
 * Forgejo exposes no per-comment parent link, so threading is reconstructed from
 * the parent-id marker the tool stamps on every reply it posts (see
 * forgejo-thread-reply): a marked comment nests under the conversation of the
 * exact comment it answered, while every unmarked comment is its own root — so
 * two distinct findings a single review left on the same line stay separate
 * items, each keeping its own reaction-backed status. A marked reply whose
 * parent isn't present (its root was filtered out) is dropped rather than
 * resurfacing as fresh feedback. Comments are walked oldest-first so a reply's
 * parent — always created earlier, hence a lower id — is grouped before it.
 */

import type { ForgejoReviewComment } from "./forgejo-schemas.js";
import { threadReplyParentId } from "./forgejo-thread-reply.js";

interface Conversation {
  root: ForgejoReviewComment;
  replies: ForgejoReviewComment[];
}

export function groupReviewCommentConversations(
  comments: readonly ForgejoReviewComment[],
): Conversation[] {
  const conversations: Conversation[] = [];
  const conversationByCommentId = new Map<number, Conversation>();

  for (const comment of [...comments].toSorted((a, b) => a.id - b.id)) {
    const parentId = threadReplyParentId(comment.body);
    if (parentId !== undefined) {
      const parent = conversationByCommentId.get(parentId);
      if (parent) {
        parent.replies.push(comment);
        conversationByCommentId.set(comment.id, parent);
      }
      continue;
    }
    const conversation: Conversation = { root: comment, replies: [] };
    conversations.push(conversation);
    conversationByCommentId.set(comment.id, conversation);
  }

  return conversations;
}
