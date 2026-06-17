/**
 * Fetch every inline review comment on a Forgejo PR.
 *
 * Forgejo has no PR-wide review-comment endpoint, so comments are gathered per
 * review and flattened. Reviews are fetched first, then each review's comments
 * concurrently to avoid an N+1 waterfall.
 */

import { forgejoFetchAll, forgejoFetchList } from "./forgejo-cli.js";
import { ForgejoReview, ForgejoReviewComment } from "./forgejo-schemas.js";

export async function fetchPullReviewComments(
  slug: string,
  prNumber: number,
): Promise<ForgejoReviewComment[]> {
  const reviewsRaw = await forgejoFetchAll<unknown>(`repos/${slug}/pulls/${prNumber}/reviews`);
  const reviews = reviewsRaw.map((r) => ForgejoReview.parse(r));

  const commentLists = await Promise.all(
    reviews.map((review) =>
      forgejoFetchList<unknown>(
        `repos/${slug}/pulls/${prNumber}/reviews/${review.id}/comments`,
      ).then((raw) => raw.map((c) => ForgejoReviewComment.parse(c))),
    ),
  );

  return commentLists.flat();
}
