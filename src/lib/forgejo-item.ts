/**
 * Forgejo item resolution: map a per-repo id to the kind of feedback it is.
 *
 * The probes are PR-scoped or ownership-checked so a stale/mistyped id from
 * another PR is never acted on. Forgejo has no repo-scoped review-comment-by-id
 * endpoint and its issue-comment endpoint rejects non-issue comments, so inline
 * review comments are found by enumerating this PR's reviews.
 */

import type { FeedbackItemRef } from "./feedback-backend.js";
import { forgejoFetch, isForgejoNotFound } from "./forgejo-cli.js";
import { ForgejoIssueComment, ForgejoReview } from "./forgejo-schemas.js";
import type { ForgejoReviewComment } from "./forgejo-schemas.js";
import { fetchPullReviewComments } from "./forgejo-pull-review-comments.js";

export type ForgejoItemKind = "review-comment" | "issue-comment" | "review";

export interface ForgejoItemMeta {
  kind: ForgejoItemKind;
  prNumber: number;
  /** Present for review-comment kind; carries the review id + line a threaded reply targets. */
  reviewComment?: ForgejoReviewComment;
}

interface ResolvedForgejoItem {
  meta: ForgejoItemMeta;
  reviewComment?: ForgejoReviewComment;
  issueComment?: ForgejoIssueComment;
  review?: ForgejoReview;
}

export function metaKindToItemType(kind: ForgejoItemKind): FeedbackItemRef["type"] {
  if (kind === "review-comment") {
    return "thread";
  }
  if (kind === "issue-comment") {
    return "comment";
  }
  return "review";
}

/**
 * True only when the URL's trailing id is exactly `target` — a confirmed match.
 * Fails closed: an empty or unparseable URL is not a confirmation, so ownership
 * is never assumed when it can't be proven.
 */
function urlTargetsNumber(url: string, target: number): boolean {
  const match = /\/(\d+)\/?$/u.exec(url);
  return match !== null && Number(match[1]) === target;
}

async function findReviewComment(
  slug: string,
  prNumber: number,
  itemId: number,
): Promise<ForgejoReviewComment | undefined> {
  const comments = await fetchPullReviewComments(slug, prNumber);
  return comments.find((c) => c.id === itemId);
}

export async function resolveItemMeta(
  slug: string,
  prNumber: number,
  itemId: number,
): Promise<ResolvedForgejoItem | undefined> {
  // Issue comment: repo-scoped, so confirm it belongs to this PR before
  // accepting; otherwise fall through to the PR-scoped probes below. A PR's
  // conversation comments populate `pull_request_url` and leave `issue_url`
  // empty (only non-PR issue comments set `issue_url`), so check both. Forgejo
  // returns 204 (-> undefined) when the id is a comment but NOT a plain issue
  // comment (e.g. an inline review comment), so skip parsing in that case
  // rather than letting Zod throw on undefined.
  try {
    const raw = await forgejoFetch<unknown>({ path: `repos/${slug}/issues/comments/${itemId}` });
    if (raw !== undefined) {
      const issueComment = ForgejoIssueComment.parse(raw);
      const ownsPr =
        urlTargetsNumber(issueComment.pull_request_url, prNumber) ||
        urlTargetsNumber(issueComment.issue_url, prNumber);
      if (ownsPr) {
        return { meta: { kind: "issue-comment", prNumber }, issueComment };
      }
    }
  } catch (error) {
    if (!isForgejoNotFound(error)) {
      throw error;
    }
  }

  // Review: the path is PR-scoped, so a review from another PR 404s.
  try {
    const raw = await forgejoFetch<unknown>({
      path: `repos/${slug}/pulls/${prNumber}/reviews/${itemId}`,
    });
    const review = ForgejoReview.parse(raw);
    return { meta: { kind: "review", prNumber }, review };
  } catch (error) {
    if (!isForgejoNotFound(error)) {
      throw error;
    }
  }

  const reviewComment = await findReviewComment(slug, prNumber, itemId);
  if (reviewComment) {
    return { meta: { kind: "review-comment", prNumber, reviewComment }, reviewComment };
  }

  return undefined;
}
