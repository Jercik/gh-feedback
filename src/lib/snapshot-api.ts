import {
  ForgejoSnapshotReview,
  ForgejoSnapshotReviewComment,
  ForgejoSnapshotIssueComment,
  ForgejoReaction,
} from "./forgejo-schemas.js";
import type { FindingState, IssueCommentRecord } from "./feedback-types.js";
import { verboseLog } from "./verbose-mode.js";

import { reactionsPath } from "./forgejo-reactions.js";
import { deriveStatus, userRef } from "./feedback-values.js";
import { forgejoResponse } from "./forgejo-cli.js";
import { fetchPaginatedListing, requireTotalCount } from "./forgejo-review-pages.js";

export async function fetchFindingStatus(
  slug: string,
  viewer: string,
  commentId: number,
  dismissible: boolean,
): Promise<FindingState> {
  const path = reactionsPath(slug, commentId);
  const response = await forgejoResponse({ path });
  const parsed = await response.json();
  // Forgejo answers JSON null for a comment with no reactions.
  if (parsed === null) {
    return deriveStatus([], dismissible);
  }
  if (!Array.isArray(parsed)) {
    throw new TypeError(`GET ${path}: expected a JSON array or null`);
  }
  const contents: string[] = [];
  for (const entry of parsed) {
    const reaction = ForgejoReaction.parse(entry);
    if (reaction.user?.login === viewer) {
      contents.push(reaction.content);
    }
  }
  // Snapshot evidence retains unknown names and duplicates, sorted for stable comparisons.
  return deriveStatus(contents.toSorted(), dismissible);
}

export async function fetchRawReviews(
  slug: string,
  pr: number,
  limit: number,
  pass: number,
): Promise<{ totalCount: number; rawById: Map<number, ForgejoSnapshotReview> }> {
  const listing = await fetchPaginatedListing(`repos/${slug}/pulls/${pr}/reviews`, limit);
  const rawById = new Map<number, ForgejoSnapshotReview>();
  for (const item of listing.items) {
    const review = ForgejoSnapshotReview.parse(item);
    rawById.set(review.id, review);
  }
  verboseLog(`pass ${pass}: reviews complete (X-Total-Count ${listing.totalCount})`);
  return { totalCount: listing.totalCount, rawById };
}

export async function fetchReviewComments(
  slug: string,
  pr: number,
  reviewId: number,
): Promise<ForgejoSnapshotReviewComment[]> {
  const path = `repos/${slug}/pulls/${pr}/reviews/${reviewId}/comments`;
  const response = await forgejoResponse({ path });
  const parsed = await response.json();
  const items = parsed === null ? [] : parsed;
  if (!Array.isArray(items)) {
    throw new TypeError(`GET ${path}: expected a JSON array`);
  }
  return items.map((item) => ForgejoSnapshotReviewComment.parse(item));
}

export async function fetchIssueComments(
  slug: string,
  pr: number,
  viewer: string,
): Promise<{ totalCount: number; records: IssueCommentRecord[] }> {
  // Unpaged on purpose: Forgejo's issue-comments route takes no page or limit and answers with the
  // whole set, so the count check below is a completeness proof rather than a paging loop.
  const path = `repos/${slug}/issues/${pr}/comments`;
  const response = await forgejoResponse({ path });
  const totalCount = requireTotalCount(response, path);
  const parsed = await response.json();
  const items = parsed === null ? [] : parsed;
  if (!Array.isArray(items)) {
    throw new TypeError(`GET ${path}: expected a JSON array`);
  }
  const byId = new Map<number, IssueCommentRecord>();
  for (const item of items) {
    const record = ForgejoSnapshotIssueComment.parse(item);
    byId.set(record.id, {
      id: record.id,
      user: userRef(record.user) ?? { id: null, login: null },
      body: record.body,
      createdAt: record.created_at ?? null,
      updatedAt: record.updated_at ?? null,
      htmlUrl: record.html_url ?? null,
      ...(await fetchFindingStatus(slug, viewer, record.id, false)),
    });
  }
  if (byId.size !== totalCount) {
    throw new Error(
      `GET ${path}: ${byId.size} distinct comment ids vs X-Total-Count ${totalCount} — completeness unproven`,
    );
  }
  return { totalCount, records: [...byId.values()].toSorted((a, b) => a.id - b.id) };
}
