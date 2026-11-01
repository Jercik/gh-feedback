import type { CommentRecord, ConversationRecord, Side } from "./feedback-types.js";

import { integerOrZero, userRef } from "./feedback-values.js";
import { stringOrNull } from "./forgejo-json-values.js";

import { threadReplyParentId } from "./forgejo-thread-reply.js";

function inlineCommentSide(position: number, originalPosition: number): Side {
  if (position === 0 && originalPosition === 0) {
    return "zero";
  }
  return position === 0 ? "old" : "new";
}

export function normalizeInlineComment(
  raw: Record<string, unknown>,
  listingReviewId: number,
  viewer: string,
  diagnostics: string[],
): CommentRecord {
  const id = raw.id;
  if (typeof id !== "number") {
    throw new TypeError(`review ${listingReviewId}: inline comment without a numeric id`);
  }
  const position = integerOrZero(raw.position);
  const originalPosition = integerOrZero(raw.original_position);
  const side = inlineCommentSide(position, originalPosition);
  const extraLinesCount = integerOrZero(raw.extra_lines_count);
  const displayLine = (position === 0 ? originalPosition : position) + extraLinesCount;
  const body = typeof raw.body === "string" ? raw.body : "";
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
  return {
    id,
    kind: isReply ? "reply" : "finding",
    replyTo,
    user,
    body,
    createdAt: stringOrNull(raw.created_at),
    path: typeof raw.path === "string" ? raw.path : "",
    position,
    originalPosition,
    extraLinesCount,
    side,
    displayLine,
    pullRequestReviewId: typeof reviewIdField === "number" ? reviewIdField : listingReviewId,
    htmlUrl: stringOrNull(raw.html_url),
    resolver: userRef(raw.resolver),
    viewerReactions: null,
    status: null,
    conflictingFinalReactions: false,
  };
}

function commentOrder(a: CommentRecord, b: CommentRecord): number {
  const aTime = a.createdAt === null ? Number.MAX_SAFE_INTEGER : Date.parse(a.createdAt);
  const bTime = b.createdAt === null ? Number.MAX_SAFE_INTEGER : Date.parse(b.createdAt);
  const aOrder = Number.isNaN(aTime) ? Number.MAX_SAFE_INTEGER : aTime;
  const bOrder = Number.isNaN(bTime) ? Number.MAX_SAFE_INTEGER : bTime;
  if (aOrder !== bOrder) {
    return aOrder - bOrder;
  }
  return a.id - b.id;
}

export function deriveConversations(publishedComments: CommentRecord[]): ConversationRecord[] {
  const groups = new Map<string, CommentRecord[]>();
  for (const comment of publishedComments) {
    const key = [comment.pullRequestReviewId, comment.side, comment.displayLine, comment.path].join(
      "\u0000",
    );
    const bucket = groups.get(key);
    if (bucket === undefined) {
      groups.set(key, [comment]);
    } else {
      bucket.push(comment);
    }
  }
  const conversations: ConversationRecord[] = [];
  for (const bucket of groups.values()) {
    bucket.sort(commentOrder);
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
