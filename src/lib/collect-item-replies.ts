import type { ClassifiedIssueComment, CommentRecord, ReviewRecord } from "./feedback-types.js";
import { stripForgejoReplyMarker } from "./forgejo-reply.js";
import { stripThreadReplyMarker } from "./forgejo-thread-reply.js";
import { mapCommentsToItems } from "./map-comments-to-items.js";

export interface ItemReply {
  id: number;
  author: string;
  createdAt: string | null;
  body: string;
}

interface ItemReplies {
  threadReplies: ItemReply[];
  prCommentReplies: ItemReply[];
}

export function collectItemReplies(comments: {
  reviews: { records: readonly ReviewRecord[] };
  conversations: readonly { comments: readonly CommentRecord[] }[];
  issueComments: { records: readonly ClassifiedIssueComment[] };
}): Map<number, ItemReplies> {
  const inlineComments = comments.conversations
    .flatMap((conversation) => conversation.comments)
    .toSorted((a, b) => a.id - b.id);
  const itemIds = mapCommentsToItems(
    comments.reviews.records,
    inlineComments,
    comments.issueComments.records,
  );
  const repliesByItem = new Map<number, ItemReplies>();
  const repliesOf = (commentId: number): ItemReplies | undefined => {
    const itemId = itemIds.get(commentId);
    if (itemId === undefined) {
      return undefined;
    }
    const replies = repliesByItem.get(itemId) ?? { threadReplies: [], prCommentReplies: [] };
    repliesByItem.set(itemId, replies);
    return replies;
  };
  for (const comment of inlineComments) {
    if (comment.kind === "reply") {
      repliesOf(comment.id)?.threadReplies.push({
        id: comment.id,
        author: comment.user.login ?? "ghost",
        createdAt: comment.createdAt,
        body: stripThreadReplyMarker(comment.body),
      });
    }
  }
  for (const comment of comments.issueComments.records) {
    if (comment.kind === "reply") {
      repliesOf(comment.id)?.prCommentReplies.push({
        id: comment.id,
        author: comment.user.login ?? "ghost",
        createdAt: comment.createdAt,
        body: stripForgejoReplyMarker(comment.body),
      });
    }
  }
  return repliesByItem;
}
