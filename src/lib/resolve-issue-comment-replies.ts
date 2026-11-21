import type { InlineCommentFields, IssueCommentFields, ReviewFields } from "./feedback-types.js";
import { parseViewerIssueCommentReply } from "./forgejo-reply.js";
import { mapCommentsToItems } from "./map-comments-to-items.js";

export function resolveIssueCommentReplies(
  pass: {
    reviews: readonly ReviewFields[];
    inlineComments: readonly InlineCommentFields[];
    issueComments: readonly IssueCommentFields[];
  },
  viewer: string,
): Map<number, number> {
  const itemIds = mapCommentsToItems(pass.reviews, pass.inlineComments, []);
  const issueComments = new Map(pass.issueComments.map((comment) => [comment.id, comment]));
  const replyTargets = new Map<number, number>();
  const settled = new Set<number>();
  const settle = (comment: IssueCommentFields, visiting: Set<number>): void => {
    if (settled.has(comment.id)) {
      return;
    }
    visiting.add(comment.id);
    const reply = parseViewerIssueCommentReply(
      { author: comment.user.login, body: comment.body },
      viewer,
    );
    const target = reply && issueComments.get(reply.targetId);
    if (reply && target && !visiting.has(target.id)) {
      settle(target, visiting);
      replyTargets.set(comment.id, target.id);
    } else if (reply && !target && itemIds.has(reply.targetId)) {
      replyTargets.set(comment.id, reply.targetId);
    }
    settled.add(comment.id);
  };
  for (const comment of pass.issueComments) {
    settle(comment, new Set());
  }
  return replyTargets;
}
