import {
  fetchIssueComments,
  fetchRawReviews,
  fetchReviewComments,
  fetchViewerReactions,
  progress,
} from "./snapshot-api.js";
import { deriveConversations, normalizeInlineComment } from "./feedback-model.js";
import { deriveStatus, parseBackingCommentId, userRef } from "./feedback-values.js";
import { stringOrNull } from "./forgejo-json-values.js";
import type { CommentRecord, PassSnapshot, ReviewRecord } from "./feedback-types.js";

function reportCountGap(totalCount: number, distinctCount: number, diagnostics: string[]): void {
  const countGap = totalCount - distinctCount;
  if (countGap > 0) {
    diagnostics.push(
      `reviews: X-Total-Count ${totalCount} vs ${distinctCount} distinct visible — a gap of ${countGap} is another user's unpublished draft`,
    );
  }
  if (countGap < 0) {
    diagnostics.push(
      `reviews: ${distinctCount} distinct visible exceed X-Total-Count ${totalCount} — the list moved mid-fetch`,
    );
  }
}

async function applyFindingStatuses(
  comments: CommentRecord[],
  host: string,
  slug: string,
  viewer: string,
): Promise<void> {
  for (const comment of comments) {
    if (comment.kind !== "finding") {
      continue;
    }
    comment.viewerReactions = await fetchViewerReactions(host, slug, viewer, comment.id);
    const derived = deriveStatus(comment.viewerReactions);
    comment.status = derived.status;
    comment.conflictingFinalReactions = derived.conflictingFinalReactions;
  }
}

function reportMissingReplies(comments: CommentRecord[], diagnostics: string[]): void {
  const publishedIds = new Set(comments.map((comment) => comment.id));
  for (const comment of comments) {
    if (comment.kind !== "reply" || comment.replyTo === null) {
      continue;
    }
    if (!publishedIds.has(comment.replyTo)) {
      diagnostics.push(
        `reply ${comment.id} references comment ${comment.replyTo}, which this sweep did not return`,
      );
    }
  }
}

async function normalizeReview(
  raw: Record<string, unknown>,
  reviewId: number,
  host: string,
  slug: string,
  pr: number,
  viewer: string,
  diagnostics: string[],
  publishedComments: CommentRecord[],
  unpublishedComments: CommentRecord[],
): Promise<ReviewRecord> {
  const state = typeof raw.state === "string" ? raw.state : "";
  const unpublished = state === "PENDING";
  const htmlUrl = stringOrNull(raw.html_url);
  const rawComments = await fetchReviewComments(host, slug, pr, reviewId);
  for (const entry of rawComments) {
    const comment = normalizeInlineComment(entry, reviewId, viewer, diagnostics);
    (unpublished ? unpublishedComments : publishedComments).push(comment);
  }

  let backingCommentId: number | null = null;
  let viewerReactions: string[] | null = null;
  let status: ReviewRecord["status"] = null;
  let conflictingFinalReactions = false;
  if (!unpublished) {
    backingCommentId = parseBackingCommentId(htmlUrl);
    if (backingCommentId === null) {
      diagnostics.push(
        `review ${reviewId}: html_url carries no #issuecomment anchor, so its status is underivable`,
      );
    } else {
      viewerReactions = await fetchViewerReactions(host, slug, viewer, backingCommentId);
      ({ status, conflictingFinalReactions } = deriveStatus(viewerReactions));
    }
  }
  return {
    id: reviewId,
    state,
    unpublished,
    user: userRef(raw.user) ?? { id: null, login: null },
    body: typeof raw.body === "string" ? raw.body : "",
    submittedAt: stringOrNull(raw.submitted_at),
    commitId: stringOrNull(raw.commit_id),
    htmlUrl,
    backingCommentId,
    viewerReactions,
    status,
    conflictingFinalReactions,
  };
}

export async function runPass(
  host: string,
  slug: string,
  pr: number,
  viewer: string,
  limit: number,
  pass: number,
): Promise<{ snapshot: PassSnapshot; diagnostics: string[] }> {
  const diagnostics: string[] = [];
  const { totalCount, rawById } = await fetchRawReviews(host, slug, pr, limit, pass);
  const reviewRecords: ReviewRecord[] = [];
  const publishedComments: CommentRecord[] = [];
  const unpublishedComments: CommentRecord[] = [];

  for (const reviewId of [...rawById.keys()].toSorted((a, b) => a - b)) {
    const raw = rawById.get(reviewId);
    if (raw === undefined) {
      continue;
    }
    reviewRecords.push(
      await normalizeReview(
        raw,
        reviewId,
        host,
        slug,
        pr,
        viewer,
        diagnostics,
        publishedComments,
        unpublishedComments,
      ),
    );
  }
  await applyFindingStatuses(publishedComments, host, slug, viewer);
  reportMissingReplies(publishedComments, diagnostics);
  const conversations = deriveConversations(publishedComments);
  const issueComments = await fetchIssueComments(host, slug, pr);
  for (const comment of issueComments.records) {
    comment.viewerReactions = await fetchViewerReactions(host, slug, viewer, comment.id);
    Object.assign(comment, deriveStatus(comment.viewerReactions));
  }
  const distinctCount = reviewRecords.length;
  const countGap = totalCount - distinctCount;
  reportCountGap(totalCount, distinctCount, diagnostics);
  unpublishedComments.sort((a, b) => a.id - b.id);
  progress(
    `pass ${pass}: ${distinctCount} reviews (${reviewRecords.filter((r) => r.unpublished).length} unpublished), ` +
      `${publishedComments.length} inline comments in ${conversations.length} conversations, ` +
      `${issueComments.records.length} issue comments`,
  );
  return {
    snapshot: {
      reviews: { totalCount, distinctCount, countGap, records: reviewRecords },
      issueComments,
      conversations,
      unpublishedInlineComments: unpublishedComments,
    },
    diagnostics,
  };
}
