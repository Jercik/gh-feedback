const ACTIONS_IDENTITY_ID = -2;
const SUMMARY_MARKER = "<!-- review:summary -->";
const STAMP_LINE =
  /^\*\*Review\*\* `(?<reviewId>[0-9A-HJKMNP-TV-Z]{26})` — head `(?<head>[0-9a-f]{40})`$/u;

interface SummaryCandidate {
  id: number;
  user?: { id?: number | null | undefined } | null | undefined;
  body: string;
  updated_at?: string | null | undefined;
}

export interface ReviewStamp {
  reviewId: string;
  head: string;
}

export interface SummaryReport {
  commentId: number;
  updatedAt: string | null;
  stamp: ReviewStamp | null;
}

export function parseReviewStamp(body: string): ReviewStamp | null {
  const match = STAMP_LINE.exec(body.split("\n")[1] ?? "");
  const groups = match?.groups;
  if (groups?.reviewId === undefined || groups.head === undefined) {
    return null;
  }
  return { reviewId: groups.reviewId, head: groups.head };
}

export function findSummaryReport(comments: readonly SummaryCandidate[]): SummaryReport | null {
  const summary = comments
    .filter((c) => c.user?.id === ACTIONS_IDENTITY_ID && c.body.startsWith(SUMMARY_MARKER))
    .toSorted((a, b) => a.id - b.id)[0];
  if (summary === undefined) {
    return null;
  }
  return {
    commentId: summary.id,
    updatedAt: summary.updated_at ?? null,
    stamp: parseReviewStamp(summary.body),
  };
}
