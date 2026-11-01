import { verboseLog } from "./verbose-mode.js";
import {
  fetchIssueComments,
  fetchRawReviews,
  fetchReviewComments,
  fetchFindingStatus,
} from "./snapshot-api.js";
import { deriveConversations, normalizeInlineComment } from "./feedback-model.js";
import type { NormalizedInlineComment } from "./feedback-model.js";
import { unfetchedFindingState, parseBackingCommentId, userRef } from "./feedback-values.js";
import type { ForgejoSnapshotReview } from "./forgejo-schemas.js";
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
  slug: string,
  viewer: string,
): Promise<void> {
  for (const comment of comments) {
    if (comment.kind !== "finding") {
      continue;
    }
    Object.assign(comment, await fetchFindingStatus(slug, viewer, comment.id));
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
  raw: ForgejoSnapshotReview,
  reviewId: number,
  slug: string,
  pr: number,
  viewer: string,
  diagnostics: string[],
  publishedComments: NormalizedInlineComment[],
  unpublishedComments: CommentRecord[],
): Promise<ReviewRecord> {
  const state = raw.state;
  const unpublished = state === "PENDING";
  const htmlUrl = raw.html_url ?? null;
  const rawComments = await fetchReviewComments(slug, pr, reviewId);
  for (const entry of rawComments) {
    const comment = normalizeInlineComment(entry, reviewId, viewer, diagnostics);
    if (unpublished) {
      unpublishedComments.push(comment.comment);
    } else {
      publishedComments.push(comment);
    }
  }

  let backingCommentId: number | null = null;
  let reactionStatus: Pick<
    ReviewRecord,
    "viewerReactions" | "status" | "conflictingFinalReactions"
  > = unfetchedFindingState;
  if (!unpublished) {
    backingCommentId = parseBackingCommentId(htmlUrl);
    if (backingCommentId === null) {
      diagnostics.push(
        `review ${reviewId}: html_url carries no #issuecomment anchor, so its status is underivable`,
      );
    } else {
      reactionStatus = await fetchFindingStatus(slug, viewer, backingCommentId);
    }
  }
  return {
    id: reviewId,
    state,
    unpublished,
    user: userRef(raw.user) ?? { id: null, login: null },
    body: raw.body,
    submittedAt: raw.submitted_at ?? null,
    commitId: raw.commit_id ?? null,
    htmlUrl,
    backingCommentId,
    ...reactionStatus,
  };
}

export async function runPass(
  slug: string,
  pr: number,
  viewer: string,
  limit: number,
  pass: number,
): Promise<{ snapshot: PassSnapshot; diagnostics: string[] }> {
  const diagnostics: string[] = [];
  const { totalCount, rawById } = await fetchRawReviews(slug, pr, limit, pass);
  const reviewRecords: ReviewRecord[] = [];
  const publishedComments: NormalizedInlineComment[] = [];
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
        slug,
        pr,
        viewer,
        diagnostics,
        publishedComments,
        unpublishedComments,
      ),
    );
  }
  const publishedRecords = publishedComments.map(({ comment }) => comment);
  await applyFindingStatuses(publishedRecords, slug, viewer);
  reportMissingReplies(publishedRecords, diagnostics);
  const conversations = deriveConversations(publishedComments);
  const issueComments = await fetchIssueComments(slug, pr, viewer);
  const distinctCount = reviewRecords.length;
  const countGap = totalCount - distinctCount;
  reportCountGap(totalCount, distinctCount, diagnostics);
  unpublishedComments.sort((a, b) => a.id - b.id);
  verboseLog(
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
