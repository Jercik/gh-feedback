/**
 * Forgejo summary aggregation.
 *
 * Forgejo has no GraphQL, so the summary is assembled from separate endpoints
 * (PR + reviews + review-comments + issue-comments + reactions). A review with
 * a body becomes a feedback item; its inline comments become a thread keyed by
 * the review's first comment.
 */

import type { FeedbackItem, FeedbackResponse, FeedbackSummary } from "./summary-types.js";
import { forgejoFetch, forgejoFetchAll } from "./forgejo-cli.js";
import {
  ForgejoIssueComment,
  ForgejoPull,
  ForgejoReview,
  ForgejoReviewComment,
} from "./forgejo-schemas.js";
import { normalizeForgejoReactions, fetchReactions, deriveIsDone } from "./forgejo-reactions.js";
import { getForgejoViewer } from "./forgejo-environment.js";
import { formatLocation, reactionToStatus } from "./summary-types.js";
import { isIgnoredAuthor } from "./github-environment.js";

export async function buildSummary(slug: string, prNumber: number): Promise<FeedbackSummary> {
  const viewer = await getForgejoViewer();

  const pullRaw = await forgejoFetch<unknown>({ path: `repos/${slug}/pulls/${prNumber}` });
  const pull = ForgejoPull.parse(pullRaw);
  const title = pull.title;
  const url = pull.html_url;

  const reviewsRaw = await forgejoFetchAll<unknown>(`repos/${slug}/pulls/${prNumber}/reviews`);
  const reviews = reviewsRaw.map((r) => ForgejoReview.parse(r));

  const issueCommentsRaw = await forgejoFetchAll<unknown>(
    `repos/${slug}/issues/${prNumber}/comments`,
  );
  const issueComments = issueCommentsRaw.map((c) => ForgejoIssueComment.parse(c));

  const items: FeedbackItem[] = [];

  for (const review of reviews) {
    const reviewComments = await forgejoFetchAll<unknown>(
      `repos/${slug}/pulls/${prNumber}/reviews/${review.id}/comments`,
    ).then((raw) => raw.map((c) => ForgejoReviewComment.parse(c)));

    const visibleComments = reviewComments
      .filter((c) => !c.user || !isIgnoredAuthor(c.user.login))
      .toSorted((a, b) => a.id - b.id);

    const first = visibleComments[0];
    if (first) {
      const firstReactions = await fetchReactions(slug, "review-comment", first.id);
      const responses: FeedbackResponse[] = visibleComments.slice(1).map((c) => ({
        author: c.user?.login ?? "ghost",
        timestamp: c.created_at,
        body: c.body,
      }));

      const normalized = normalizeForgejoReactions(firstReactions, viewer);
      items.push({
        id: first.id,
        timestamp: first.created_at,
        status: reactionToStatus(normalized, deriveIsDone(firstReactions, viewer)),
        author: first.user?.login ?? "ghost",
        location: formatLocation(first.path, first.position ?? null),
        body: first.body,
        responses,
      });
    }

    const body = review.body.trim();
    if (body.length > 0 && (!review.user || !isIgnoredAuthor(review.user.login))) {
      items.push({
        id: review.id,
        timestamp: review.submitted_at,
        status: "pending",
        author: review.user?.login ?? "ghost",
        location: "",
        body: review.body,
        responses: [],
      });
    }
  }

  for (const comment of issueComments) {
    const body = comment.body.trim();
    if (body.length === 0 || (comment.user && isIgnoredAuthor(comment.user.login))) {
      continue;
    }
    const reactions = await fetchReactions(slug, "issue-comment", comment.id);
    const normalized = normalizeForgejoReactions(reactions, viewer);
    items.push({
      id: comment.id,
      timestamp: comment.created_at,
      status: reactionToStatus(normalized, deriveIsDone(reactions, viewer)),
      author: comment.user?.login ?? "ghost",
      location: "",
      body: comment.body,
      responses: [],
    });
  }

  items.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

  return { prNumber, prUrl: url, prTitle: title, items };
}
