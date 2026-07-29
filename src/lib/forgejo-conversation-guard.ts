import type { FeedbackItemRef } from "./feedback-backend.js";
import { groupReviewCommentConversations } from "./forgejo-conversations.js";
import { getForgejoViewer } from "./forgejo-environment.js";
import { fetchPullReviewComments } from "./forgejo-pull-review-comments.js";
import { fetchReactions, viewerReactionStrings } from "./forgejo-reactions.js";
import { reviewCommentDisplayLine } from "./forgejo-review-comment-line.js";
import type { ForgejoReviewComment } from "./forgejo-schemas.js";
import { isIgnoredAuthor } from "./github-environment.js";

export function isForgejoSiblingSettledForResolution(reactions: readonly string[]): boolean {
  const finals = reactions.filter((reaction) => ["+1", "-1", "rocket"].includes(reaction));
  return finals.length === 1 && (finals[0] === "+1" || finals[0] === "rocket");
}

export function sameForgejoNativeConversation(
  left: ForgejoReviewComment,
  right: ForgejoReviewComment,
): boolean {
  const leftLine = reviewCommentDisplayLine(left);
  const rightLine = reviewCommentDisplayLine(right);
  if (
    leftLine === null ||
    rightLine === null ||
    left.pull_request_review_id === null ||
    left.pull_request_review_id === undefined ||
    right.pull_request_review_id === null ||
    right.pull_request_review_id === undefined ||
    !left.path ||
    !right.path
  ) {
    return false;
  }
  return (
    left.pull_request_review_id === right.pull_request_review_id &&
    left.path === right.path &&
    leftLine === rightLine
  );
}

export function hasForgejoNativeConversationKey(comment: ForgejoReviewComment): boolean {
  return (
    reviewCommentDisplayLine(comment) !== null &&
    comment.pull_request_review_id !== null &&
    comment.pull_request_review_id !== undefined &&
    Boolean(comment.path)
  );
}

export function forgejoNativeConversationSiblingRoots(
  reviewComments: readonly ForgejoReviewComment[],
  viewer: string,
  itemId: number,
): ForgejoReviewComment[] | undefined {
  const comments = reviewComments.filter(
    (comment) => !comment.user || !isIgnoredAuthor(comment.user.login),
  );
  if (comments.some((comment) => !hasForgejoNativeConversationKey(comment))) {
    return undefined;
  }

  const conversations = groupReviewCommentConversations(comments, viewer);
  const target = conversations.find(
    ({ root, replies }) => root.id === itemId || replies.some((reply) => reply.id === itemId),
  );
  if (!target) {
    return undefined;
  }
  return conversations
    .filter(
      ({ root }) => root.id !== target.root.id && sameForgejoNativeConversation(root, target.root),
    )
    .map(({ root }) => root);
}

export function forgejoNativeConversationAnchor(
  comments: readonly ForgejoReviewComment[],
  target: ForgejoReviewComment | undefined,
): ForgejoReviewComment | undefined {
  if (!target) {
    return undefined;
  }
  return (
    comments
      .filter((comment) => sameForgejoNativeConversation(comment, target))
      .toSorted((left, right) => left.id - right.id)[0] ?? target
  );
}

export function forgejoNativeConversationResolver(
  comments: readonly ForgejoReviewComment[],
  target: ForgejoReviewComment | undefined,
) {
  return forgejoNativeConversationAnchor(comments, target)?.resolver;
}

export async function forgejoConversationReadyToResolve(
  slug: string,
  item: FeedbackItemRef,
  availableComments?: readonly ForgejoReviewComment[],
): Promise<boolean> {
  if (item.type !== "thread") {
    return true;
  }

  const viewer = await getForgejoViewer();
  const reviewComments = availableComments ?? (await fetchPullReviewComments(slug, item.prNumber));
  const siblings = forgejoNativeConversationSiblingRoots(reviewComments, viewer, item.id);
  if (!siblings) {
    return false;
  }
  for (const root of siblings) {
    const reactions = await fetchReactions(slug, "review-comment", root.id);
    if (!isForgejoSiblingSettledForResolution(viewerReactionStrings(reactions, viewer))) {
      return false;
    }
  }
  return true;
}
