import {
  ForgejoReview,
  ForgejoReviewComment,
  ForgejoIssueComment,
  ForgejoReaction,
} from "./forgejo-schemas.js";
import type { IssueCommentRecord } from "./feedback-types.js";
import { asRecord, stringOrNull } from "./forgejo-json-values.js";
import { userRef } from "./feedback-values.js";
import { forgejoResponse } from "./forgejo-cli.js";
import { fetchReviewListing } from "./forgejo-review-pages.js";
import { verboseLog } from "./verbose-mode.js";

async function apiGet(_host: string, path: string): Promise<Response> {
  return forgejoResponse({ path });
}
async function parseJsonBody(response: Response, _path: string): Promise<unknown> {
  return response.json();
}
function requireTotalCount(response: Response, path: string): number {
  const value = response.headers.get("X-Total-Count");
  if (value === null || !/^\d+$/u.test(value) || !Number.isSafeInteger(Number(value))) {
    throw new Error(`GET ${path}: missing or invalid X-Total-Count`);
  }
  return Number(value);
}

export function progress(message: string): void {
  verboseLog(message);
}

export async function fetchApiLimit(host: string): Promise<number> {
  const path = "settings/api";
  const settings = asRecord(await parseJsonBody(await apiGet(host, path), path));
  const limit = settings === null ? null : settings.max_response_items;
  if (typeof limit !== "number" || !Number.isInteger(limit) || limit < 1) {
    throw new Error(`GET ${path}: no usable max_response_items`);
  }
  return limit;
}

export async function fetchViewerReactions(
  host: string,
  slug: string,
  viewer: string,
  commentId: number,
): Promise<string[]> {
  const path = `repos/${slug}/issues/comments/${commentId}/reactions`;
  const parsed = await parseJsonBody(await apiGet(host, path), path);
  // Forgejo answers JSON null for a comment with no reactions.
  if (parsed === null) {
    return [];
  }
  if (!Array.isArray(parsed)) {
    throw new TypeError(`GET ${path}: expected a JSON array or null`);
  }
  const contents: string[] = [];
  for (const entry of parsed) {
    ForgejoReaction.parse(entry);
    const record = asRecord(entry);
    const user = record === null ? null : asRecord(record.user);
    const login = user === null ? null : user.login;
    const content = record === null ? null : record.content;
    if (login === viewer && typeof content === "string") {
      contents.push(content);
    }
  }
  return contents.toSorted();
}

export async function fetchRawReviews(
  host: string,
  slug: string,
  pr: number,
  limit: number,
  pass: number,
): Promise<{ totalCount: number; rawById: Map<number, Record<string, unknown>> }> {
  const listing = await fetchReviewListing(`repos/${slug}/pulls/${pr}/reviews`, limit);
  const rawById = new Map<number, Record<string, unknown>>();
  for (const item of listing.items) {
    ForgejoReview.parse(item);
    const record = asRecord(item);
    if (record === null || typeof record.id !== "number") {
      throw new Error("review without a numeric id");
    }
    rawById.set(record.id, record);
  }
  progress(`pass ${pass}: reviews complete (X-Total-Count ${listing.totalCount})`);
  return { totalCount: listing.totalCount, rawById };
}

export async function fetchReviewComments(
  host: string,
  slug: string,
  pr: number,
  reviewId: number,
): Promise<Record<string, unknown>[]> {
  const path = `repos/${slug}/pulls/${pr}/reviews/${reviewId}/comments`;
  const parsed = await parseJsonBody(await apiGet(host, path), path);
  const items = parsed === null ? [] : parsed;
  if (!Array.isArray(items)) {
    throw new TypeError(`GET ${path}: expected a JSON array`);
  }
  return items.map((item) => {
    ForgejoReviewComment.parse(item);
    const record = asRecord(item);
    if (record === null) {
      throw new Error(`GET ${path}: non-object comment entry`);
    }
    return record;
  });
}

export async function fetchIssueComments(
  host: string,
  slug: string,
  pr: number,
): Promise<{ totalCount: number; records: IssueCommentRecord[] }> {
  // Unpaged on purpose: Forgejo's issue-comments route takes no page or limit and answers with the
  // whole set, so the count check below is a completeness proof rather than a paging loop.
  const path = `repos/${slug}/issues/${pr}/comments`;
  const response = await apiGet(host, path);
  const totalCount = requireTotalCount(response, path);
  const parsed = await parseJsonBody(response, path);
  const items = parsed === null ? [] : parsed;
  if (!Array.isArray(items)) {
    throw new TypeError(`GET ${path}: expected a JSON array`);
  }
  const byId = new Map<number, IssueCommentRecord>();
  for (const item of items) {
    ForgejoIssueComment.parse(item);
    const record = asRecord(item);
    const id = record === null ? null : record.id;
    if (record === null || typeof id !== "number") {
      throw new Error(`GET ${path}: issue comment without a numeric id`);
    }
    byId.set(id, {
      id,
      user: userRef(record.user) ?? { id: null, login: null },
      body: typeof record.body === "string" ? record.body : "",
      createdAt: stringOrNull(record.created_at),
      updatedAt: stringOrNull(record.updated_at),
      htmlUrl: stringOrNull(record.html_url),
      viewerReactions: [],
      status: "pending",
      conflictingFinalReactions: false,
    });
  }
  if (byId.size !== totalCount) {
    throw new Error(
      `GET ${path}: ${byId.size} distinct comment ids vs X-Total-Count ${totalCount} — completeness unproven`,
    );
  }
  return { totalCount, records: [...byId.values()].toSorted((a, b) => a.id - b.id) };
}
