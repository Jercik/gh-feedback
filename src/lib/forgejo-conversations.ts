/**
 * Group flat Forgejo review comments into line conversations.
 *
 * Forgejo exposes no per-comment parent link, so the only reply the tool can
 * reliably re-attach is its own: a reply it posts via reviews/{id}/comments
 * inherits the parent's review id and lands on the same line. Two comments
 * therefore share a conversation only when they sit on the same
 * (reviewId, path, position, originalPosition) AND the later one is the viewer's
 * own reply. Every other comment is its own root — including a second distinct
 * finding a single review left on the same line, which must keep its own
 * reaction-backed status rather than collapse into the first. A comment missing
 * a review id or path can't be threaded, so it keys to itself and stands alone.
 */

import type { ForgejoReviewComment } from "./forgejo-schemas.js";

interface Conversation {
  root: ForgejoReviewComment;
  replies: ForgejoReviewComment[];
}

function conversationKey(comment: ForgejoReviewComment): string {
  if (typeof comment.pull_request_review_id !== "number" || typeof comment.path !== "string") {
    return `solo:${comment.id}`;
  }
  return [
    comment.pull_request_review_id,
    comment.path,
    comment.position ?? 0,
    comment.original_position ?? 0,
  ].join("\n");
}

export function groupReviewCommentConversations(
  comments: readonly ForgejoReviewComment[],
  viewer: string,
): Conversation[] {
  const conversations: Conversation[] = [];
  const rootByKey = new Map<string, Conversation>();

  for (const comment of [...comments].toSorted((a, b) => a.id - b.id)) {
    const key = conversationKey(comment);
    const current = rootByKey.get(key);
    if (current && comment.user?.login === viewer) {
      current.replies.push(comment);
      continue;
    }
    const conversation: Conversation = { root: comment, replies: [] };
    conversations.push(conversation);
    rootByKey.set(key, conversation);
  }

  return conversations;
}
