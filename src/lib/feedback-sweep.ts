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
import type {
  ClassifiedIssueComment,
  CommentRecord,
  IssueCommentRecord,
  PassSnapshot,
  ReviewRecord,
  SweptComments,
} from "./feedback-types.js";
import { resolveIssueCommentReplies } from "./resolve-issue-comment-replies.js";

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

async function fetchClassifiedIssueComments(
  slug: string,
  pr: number,
  viewer: string,
  reviews: ReviewRecord[],
  inlineComments: CommentRecord[],
): Promise<SweptComments["issueComments"]> {
  const { totalCount, comments } = await fetchIssueComments(slug, pr);
  const replyTargets = resolveIssueCommentReplies(
    { reviews, inlineComments, issueComments: comments },
    viewer,
  );
  const records = comments.map(({ id, ...fields }): ClassifiedIssueComment => {
    const replyTo = replyTargets.get(id);
    return replyTo === undefined
      ? { id, kind: "finding", replyTo: null, ...fields }
      : { id, kind: "reply", replyTo, ...fields };
  });
  return { totalCount, records };
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
  if (!unpublished) {
    backingCommentId = parseBackingCommentId(htmlUrl);
    if (backingCommentId === null) {
      diagnostics.push(
        `review ${reviewId}: html_url carries no #issuecomment anchor, so its status is underivable`,
      );
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
    ...unfetchedFindingState,
  };
}

export async function sweepComments(
  slug: string,
  pr: number,
  viewer: string,
  limit: number,
): Promise<{ comments: SweptComments; diagnostics: string[] }> {
  const diagnostics: string[] = [];
  const { totalCount, rawById } = await fetchRawReviews(slug, pr, limit);
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
  reportMissingReplies(publishedRecords, diagnostics);
  const issueComments = await fetchClassifiedIssueComments(
    slug,
    pr,
    viewer,
    reviewRecords,
    publishedRecords,
  );
  const distinctCount = reviewRecords.length;
  reportCountGap(totalCount, distinctCount, diagnostics);
  unpublishedComments.sort((a, b) => a.id - b.id);
  return {
    comments: {
      reviews: {
        totalCount,
        distinctCount,
        countGap: totalCount - distinctCount,
        records: reviewRecords,
      },
      issueComments,
      conversations: deriveConversations(publishedComments),
      unpublishedInlineComments: unpublishedComments,
    },
    diagnostics,
  };
}

export async function runPass(
  slug: string,
  pr: number,
  viewer: string,
  limit: number,
  pass: number,
): Promise<{ snapshot: PassSnapshot; diagnostics: string[] }> {
  const { comments, diagnostics } = await sweepComments(slug, pr, viewer, limit);
  const { reviews, conversations } = comments;
  verboseLog(`pass ${pass}: reviews complete (X-Total-Count ${reviews.totalCount})`);
  for (const review of reviews.records) {
    if (review.backingCommentId !== null) {
      Object.assign(
        review,
        await fetchFindingStatus(slug, viewer, review.backingCommentId, undefined),
      );
    }
  }
  const publishedRecords = conversations.flatMap((conversation) => conversation.comments);
  for (const comment of publishedRecords) {
    if (comment.kind === "finding") {
      Object.assign(comment, await fetchFindingStatus(slug, viewer, comment.id, comment));
    }
  }
  const issueRecords: IssueCommentRecord[] = [];
  for (const comment of comments.issueComments.records) {
    issueRecords.push(
      comment.kind === "finding"
        ? { ...comment, ...(await fetchFindingStatus(slug, viewer, comment.id, comment)) }
        : { ...comment, ...unfetchedFindingState },
    );
  }
  verboseLog(
    `pass ${pass}: ${reviews.distinctCount} reviews (${reviews.records.filter((r) => r.unpublished).length} unpublished), ` +
      `${publishedRecords.length} inline comments in ${conversations.length} conversations, ` +
      `${issueRecords.length} issue comments`,
  );
  return {
    snapshot: {
      ...comments,
      issueComments: { totalCount: comments.issueComments.totalCount, records: issueRecords },
    },
    diagnostics,
  };
}
