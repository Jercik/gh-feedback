import { collectItemReplies } from "./collect-item-replies.js";
import type { SweptComments } from "./feedback-types.js";
import type { ItemDetail } from "./fetch-item-detail.js";
import { stripThreadReplyMarker } from "./forgejo-thread-reply.js";
import type { ReviewState } from "./types.js";

type Detail<Type extends ItemDetail["type"]> = Extract<ItemDetail, { type: Type }>;

type ItemDetailContent =
  | Omit<Detail<"review">, "reactions">
  | Omit<Detail<"comment">, "reactions">
  | (Omit<Detail<"thread">, "comments"> & {
      comments: Omit<Detail<"thread">["comments"][number], "reactions">[];
    });

export function projectItemDetail(
  comments: SweptComments,
  itemId: number,
): ItemDetailContent | undefined {
  const replies = collectItemReplies(comments);
  const review = comments.reviews.records.find((record) => record.backingCommentId === itemId);
  if (review !== undefined) {
    return {
      type: "review",
      id: itemId,
      author: review.user.login ?? "ghost",
      state: review.state as ReviewState,
      url: review.htmlUrl ?? "",
      submittedAt: review.submittedAt ?? "",
      body: review.body,
      prCommentReplies: replies.get(itemId)?.prCommentReplies ?? [],
    };
  }
  const issueComment = comments.issueComments.records.find((record) => record.id === itemId);
  if (issueComment !== undefined) {
    return {
      type: "comment",
      id: itemId,
      author: issueComment.user.login ?? "ghost",
      url: issueComment.htmlUrl ?? "",
      createdAt: issueComment.createdAt ?? "",
      body: issueComment.body,
      prCommentReplies: replies.get(itemId)?.prCommentReplies ?? [],
    };
  }
  const inlineComments = comments.conversations.flatMap((conversation) =>
    conversation.comments.map((comment) => ({ comment, resolver: conversation.resolver })),
  );
  const target = inlineComments.find(({ comment }) => comment.id === itemId);
  if (target === undefined) {
    return undefined;
  }
  const findingId = [...replies].find(([, { threadReplies }]) =>
    threadReplies.some((reply) => reply.id === itemId),
  )?.[0];
  const { comment: root, resolver } =
    inlineComments.find(({ comment }) => comment.id === findingId) ?? target;
  const rootReplies = replies.get(root.id);
  return {
    type: "thread",
    id: root.id,
    path: root.path === "" ? null : root.path,
    line: root.position <= 0 && root.originalPosition <= 0 ? null : root.displayLine,
    // Forgejo has no outdated axis.
    isOutdated: false,
    isResolved: resolver !== null,
    comments: [
      {
        id: root.id,
        author: root.user.login ?? "ghost",
        body: stripThreadReplyMarker(root.body),
        createdAt: root.createdAt ?? "",
      },
      ...(rootReplies?.threadReplies ?? []).map((reply) => ({
        id: reply.id,
        author: reply.author,
        body: reply.body,
        createdAt: reply.createdAt ?? "",
      })),
    ],
    prCommentReplies: rootReplies?.prCommentReplies ?? [],
  };
}
