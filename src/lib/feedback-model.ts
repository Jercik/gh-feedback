import { compareForgejoCommentOrder } from "./compare-forgejo-comment-order.js";
import {
  reviewCommentConversationIdentity,
  reviewCommentCoordinates,
} from "./forgejo-review-comment-line.js";
import type { CommentRecord, ConversationRecord } from "./feedback-types.js";

import { unfetchedFindingState, integerOrZero, userRef } from "./feedback-values.js";
import type { ForgejoSnapshotReviewComment } from "./forgejo-schemas.js";

import { threadReplyParentId } from "./forgejo-thread-reply.js";

export interface NormalizedInlineComment {
  comment: CommentRecord;
  nativeIdentity: string | null;
}

export function normalizeInlineComment(
  raw: ForgejoSnapshotReviewComment,
  listingReviewId: number,
  viewer: string,
  diagnostics: string[],
): NormalizedInlineComment {
  const id = raw.id;

  const position = integerOrZero(raw.position);
  const originalPosition = integerOrZero(raw.original_position);
  const extraLinesCount = integerOrZero(raw.extra_lines_count);
  const { side, displayLine } = reviewCommentCoordinates(
    position,
    originalPosition,
    extraLinesCount,
  );
  const body = raw.body;
  const user = userRef(raw.user) ?? { id: null, login: null };
  const parentId = user.login === viewer ? threadReplyParentId(body) : undefined;
  const isReply = parentId !== undefined;
  let replyTo: number | null = null;
  if (isReply) {
    replyTo = parentId ?? null;
    if (replyTo === null) {
      diagnostics.push(`inline comment ${id}: reply marker without a parseable comment id`);
    }
  }
  const reviewIdField = raw.pull_request_review_id;
  const comment: CommentRecord = {
    id,
    kind: isReply ? "reply" : "finding",
    replyTo,
    user,
    body,
    createdAt: raw.created_at ?? null,
    path: raw.path ?? "",
    position,
    originalPosition,
    extraLinesCount,
    side,
    displayLine,
    pullRequestReviewId: reviewIdField ?? listingReviewId,
    htmlUrl: raw.html_url ?? null,
    resolver: userRef(raw.resolver),
    ...unfetchedFindingState,
  };
  return {
    comment,
    nativeIdentity: reviewCommentConversationIdentity({
      ...raw,
      user: undefined,
      resolver: undefined,
      created_at: raw.created_at ?? "",
      html_url: raw.html_url ?? "",
    }),
  };
}

// Native identity is derived before normalization fills missing coordinates. Unknown identities
// stay isolated; raw coordinate and side fields remain on every serialized comment.
export function deriveConversations(
  publishedComments: NormalizedInlineComment[],
): ConversationRecord[] {
  const groups = new Map<string, CommentRecord[]>();
  for (const { comment, nativeIdentity } of publishedComments) {
    const key = nativeIdentity ?? JSON.stringify(["unknown", comment.id]);
    const bucket = groups.get(key);
    if (bucket === undefined) {
      groups.set(key, [comment]);
    } else {
      bucket.push(comment);
    }
  }
  const conversations: ConversationRecord[] = [];
  for (const bucket of groups.values()) {
    bucket.sort(compareForgejoCommentOrder);
    const anchor = bucket[0];
    if (anchor === undefined) {
      continue;
    }
    conversations.push({
      reviewId: anchor.pullRequestReviewId,
      path: anchor.path,
      side: anchor.side,
      displayLine: anchor.displayLine,
      anchorId: anchor.id,
      resolver: anchor.resolver,
      comments: bucket,
    });
  }
  conversations.sort((a, b) => {
    if (a.path !== b.path) {
      return a.path < b.path ? -1 : 1;
    }
    if (a.displayLine !== b.displayLine) {
      return a.displayLine - b.displayLine;
    }
    if (a.reviewId !== b.reviewId) {
      return a.reviewId - b.reviewId;
    }
    return a.anchorId - b.anchorId;
  });
  return conversations;
}
