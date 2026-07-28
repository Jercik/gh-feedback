import type { FeedbackItemRef, FeedbackOutcome } from "./feedback-backend.js";
import { groupReviewCommentConversations } from "./forgejo-conversations.js";
import { getForgejoViewer } from "./forgejo-environment.js";
import { fetchPullReviewComments } from "./forgejo-pull-review-comments.js";
import { fetchReactions, viewerReactionStrings } from "./forgejo-reactions.js";
import { reviewCommentDisplayLine } from "./forgejo-review-comment-line.js";
import type { ForgejoReviewComment } from "./forgejo-schemas.js";

export function isForgejoSiblingSettledForResolution(reactions: readonly string[]): boolean {
  const finals = reactions.filter((reaction) => ["+1", "-1", "rocket"].includes(reaction));
  return finals.length === 1 && (finals[0] === "+1" || finals[0] === "rocket");
}

export function sameForgejoNativeConversation(
  left: ForgejoReviewComment,
  right: ForgejoReviewComment,
): boolean {
  return (
    left.pull_request_review_id === right.pull_request_review_id &&
    left.path === right.path &&
    reviewCommentDisplayLine(left) === reviewCommentDisplayLine(right)
  );
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
      .toSorted((left, right) => {
        const createdOrder = left.created_at.localeCompare(right.created_at);
        return createdOrder === 0 ? left.id - right.id : createdOrder;
      })[0] ?? target
  );
}

export async function blockForgejoUnsettledConversationSiblings(
  slug: string,
  item: FeedbackItemRef,
  outcome: FeedbackOutcome,
  actionVerb: string,
): Promise<void> {
  if (item.type !== "thread" || outcome === "disagreed") {
    return;
  }

  const viewer = await getForgejoViewer();
  const comments = await fetchPullReviewComments(slug, item.prNumber);
  const conversations = groupReviewCommentConversations(comments, viewer);
  const target = conversations.find(
    ({ root, replies }) => root.id === item.id || replies.some((reply) => reply.id === item.id),
  );
  if (!target) {
    return;
  }

  const siblings = conversations.filter(
    ({ root }) => root.id !== target.root.id && sameForgejoNativeConversation(root, target.root),
  );
  const unsettled: number[] = [];
  for (const { root } of siblings) {
    const reactions = await fetchReactions(slug, "review-comment", root.id);
    if (!isForgejoSiblingSettledForResolution(viewerReactionStrings(reactions, viewer))) {
      unsettled.push(root.id);
    }
  }

  if (unsettled.length > 0) {
    throw new Error(
      `Error: Cannot ${actionVerb} #${item.id} while its Forgejo conversation has unsettled sibling feedback: ${unsettled.map((id) => `#${id}`).join(", ")}.`,
    );
  }
}
