import { compareForgejoCommentOrder } from "./compare-forgejo-comment-order.js";
import { deriveStatus } from "./feedback-values.js";
import type { FeedbackItemRef } from "./feedback-backend.js";
import { groupReviewCommentConversations } from "./forgejo-conversations.js";
import { getForgejoViewer } from "./forgejo-environment.js";
import { fetchPullReviewComments } from "./forgejo-pull-review-comments.js";
import { fetchReactions, viewerReactionStrings } from "./forgejo-reactions.js";
import {
  reviewCommentConversationIdentity,
  reviewCommentDisplayLine,
} from "./forgejo-review-comment-line.js";
import type { ForgejoReviewComment } from "./forgejo-schemas.js";
import { isIgnoredAuthor } from "./feedback-environment.js";
import { isStatusSettled, settledStatuses } from "./summary-types.js";

export const RESOLVES_CONVERSATION_WHEN_SETTLED = `resolves its inline conversation, if any, once every item in it is ${new Intl.ListFormat("en", { type: "disjunction" }).format(settledStatuses)}`;

export function isForgejoSiblingSettledForResolution(reactions: readonly string[]): boolean {
  return isStatusSettled(deriveStatus([...reactions]).status);
}

export function sameForgejoNativeConversation(
  left: ForgejoReviewComment,
  right: ForgejoReviewComment,
): boolean {
  const leftKey = reviewCommentConversationIdentity(left);
  return leftKey !== null && leftKey === reviewCommentConversationIdentity(right);
}

export function hasForgejoNativeConversationKey(comment: ForgejoReviewComment): boolean {
  return reviewCommentConversationIdentity(comment) !== null;
}

function couldShareForgejoNativeConversation(
  candidate: ForgejoReviewComment,
  target: ForgejoReviewComment,
): boolean {
  const candidateLine = reviewCommentDisplayLine(candidate);
  const targetLine = reviewCommentDisplayLine(target);
  if (
    candidate.pull_request_review_id !== null &&
    candidate.pull_request_review_id !== undefined &&
    candidate.pull_request_review_id !== target.pull_request_review_id
  ) {
    return false;
  }
  if (candidate.path && candidate.path !== target.path) {
    return false;
  }
  return candidateLine === null || candidateLine === targetLine;
}

export function forgejoNativeConversationSiblingRoots(
  reviewComments: readonly ForgejoReviewComment[],
  viewer: string,
  itemId: number,
): ForgejoReviewComment[] | undefined {
  const comments = reviewComments.filter(
    (comment) => !comment.user || !isIgnoredAuthor(comment.user.login),
  );
  const conversations = groupReviewCommentConversations(comments, viewer);
  const target = conversations.find(
    ({ root, replies }) => root.id === itemId || replies.some((reply) => reply.id === itemId),
  );
  if (!target) {
    return undefined;
  }
  if (!hasForgejoNativeConversationKey(target.root)) {
    return undefined;
  }

  const siblings: ForgejoReviewComment[] = [];
  for (const { root } of conversations) {
    if (root.id === target.root.id || !couldShareForgejoNativeConversation(root, target.root)) {
      continue;
    }
    if (!hasForgejoNativeConversationKey(root)) {
      return undefined;
    }
    if (sameForgejoNativeConversation(root, target.root)) {
      siblings.push(root);
    }
  }
  return siblings;
}

export function forgejoNativeConversationAnchor(
  comments: readonly ForgejoReviewComment[],
  target: ForgejoReviewComment | undefined,
): ForgejoReviewComment | undefined {
  if (!target) {
    return undefined;
  }
  // The j4k fork stores resolver state only on the native conversation anchor, not on every grouped comment.
  return (
    comments
      .filter((comment) => sameForgejoNativeConversation(comment, target))
      .toSorted((left, right) =>
        compareForgejoCommentOrder(
          { id: left.id, createdAt: left.created_at },
          { id: right.id, createdAt: right.created_at },
        ),
      )[0] ?? target
  );
}

export function forgejoNativeConversationResolver(
  comments: readonly ForgejoReviewComment[],
  target: ForgejoReviewComment | undefined,
) {
  return forgejoNativeConversationAnchor(comments, target)?.resolver;
}

export async function getForgejoConversationResolutionReadiness(
  slug: string,
  item: FeedbackItemRef,
  availableComments?: readonly ForgejoReviewComment[],
): Promise<{ ready: true } | { ready: false; reason: string }> {
  if (item.type !== "thread") {
    return { ready: true };
  }

  const viewer = await getForgejoViewer();
  const reviewComments = availableComments ?? (await fetchPullReviewComments(slug, item.prNumber));
  const siblings = forgejoNativeConversationSiblingRoots(reviewComments, viewer, item.id);
  if (!siblings) {
    return {
      ready: false,
      reason:
        "conversation resolution was not attempted because its native grouping could not be determined",
    };
  }
  for (const root of siblings) {
    const reactions = await fetchReactions(slug, root.id);
    if (!isForgejoSiblingSettledForResolution(viewerReactionStrings(reactions, viewer))) {
      return {
        ready: false,
        reason: "conversation resolution deferred until its other findings settle",
      };
    }
  }
  return { ready: true };
}
