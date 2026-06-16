/**
 * Forgejo item resolution: map a per-repo id to the kind of feedback it is.
 *
 * Forgejo ids are unique per-repo across review-comments / issue-comments /
 * reviews, so probe each endpoint in turn until one matches.
 */

import type { DetectedItem } from "./detect-item-type.js";
import { forgejoFetch, isForgejoNotFound } from "./forgejo-cli.js";
import { ForgejoIssueComment, ForgejoReview, ForgejoReviewComment } from "./forgejo-schemas.js";

export type ForgejoItemKind = "review-comment" | "issue-comment" | "review";

export interface ForgejoItemMeta {
  kind: ForgejoItemKind;
  prNumber: number;
}

interface ResolvedForgejoItem {
  meta: ForgejoItemMeta;
  reviewComment?: ForgejoReviewComment;
  issueComment?: ForgejoIssueComment;
  review?: ForgejoReview;
}

export function metaKindToItemType(kind: ForgejoItemKind): DetectedItem["type"] {
  if (kind === "review-comment") {
    return "thread";
  }
  if (kind === "issue-comment") {
    return "comment";
  }
  return "review";
}

export async function resolveItemMeta(
  slug: string,
  prNumber: number,
  itemId: number,
): Promise<ResolvedForgejoItem | undefined> {
  try {
    const raw = await forgejoFetch<unknown>({ path: `repos/${slug}/pulls/comments/${itemId}` });
    const reviewComment = ForgejoReviewComment.parse(raw);
    return { meta: { kind: "review-comment", prNumber }, reviewComment };
  } catch (error) {
    if (!isForgejoNotFound(error)) {
      throw error;
    }
  }

  try {
    const raw = await forgejoFetch<unknown>({ path: `repos/${slug}/issues/comments/${itemId}` });
    const issueComment = ForgejoIssueComment.parse(raw);
    return { meta: { kind: "issue-comment", prNumber }, issueComment };
  } catch (error) {
    if (!isForgejoNotFound(error)) {
      throw error;
    }
  }

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

  return undefined;
}
