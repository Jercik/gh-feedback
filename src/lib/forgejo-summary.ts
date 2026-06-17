/**
 * Forgejo summary aggregation.
 *
 * Forgejo has no GraphQL, so the summary is assembled from separate endpoints
 * (PR + reviews + review-comments + issue-comments + reactions). Each PR issue
 * comment and each inline-comment line conversation becomes one feedback item;
 * later comments in a conversation (our threaded replies) nest as responses.
 *
 * Two surfaces are deliberately dropped: review *bodies* (the review entity has
 * no reaction/resolve endpoint, so an item from it could never leave "pending")
 * and the tool's own generated reply *issue* comments (identified by the reply
 * marker), which would otherwise reappear as fresh feedback after every
 * agree/disagree on a top-level comment.
 */

import type { FeedbackItem, FeedbackSummary } from "./summary-types.js";
import type { SummaryOptions } from "./feedback-backend.js";
import { forgejoFetch, forgejoFetchAll, forgejoFetchList } from "./forgejo-cli.js";
import {
  ForgejoIssueComment,
  ForgejoPull,
  ForgejoReview,
  ForgejoReviewComment,
} from "./forgejo-schemas.js";
import { normalizeForgejoReactions, fetchReactions, deriveIsDone } from "./forgejo-reactions.js";
import { reviewCommentLine } from "./forgejo-review-comment-line.js";
import { groupReviewCommentConversations } from "./forgejo-conversations.js";
import { stripThreadReplyMarker } from "./forgejo-thread-reply.js";
import { getForgejoViewer } from "./forgejo-environment.js";
import { formatLocation, reactionToStatus, isStatusDone } from "./summary-types.js";
import { isIgnoredAuthor } from "./github-environment.js";
import { FORGEJO_REPLY_MARKER } from "./forgejo-reply.js";

export async function buildSummary(
  slug: string,
  prNumber: number,
  options: SummaryOptions = {},
): Promise<FeedbackSummary> {
  const viewer = await getForgejoViewer();

  const pullRaw = await forgejoFetch<unknown>({ path: `repos/${slug}/pulls/${prNumber}` });
  const pull = ForgejoPull.parse(pullRaw);

  const reviewsRaw = await forgejoFetchAll<unknown>(`repos/${slug}/pulls/${prNumber}/reviews`);
  const reviews = reviewsRaw.map((r) => ForgejoReview.parse(r));

  const issueCommentsRaw = await forgejoFetchList<unknown>(
    `repos/${slug}/issues/${prNumber}/comments`,
  );
  const issueComments = issueCommentsRaw.map((c) => ForgejoIssueComment.parse(c));

  // Fetch every review's inline comments concurrently to avoid an N+1 waterfall.
  const reviewCommentLists = await Promise.all(
    reviews.map((review) =>
      forgejoFetchList<unknown>(
        `repos/${slug}/pulls/${prNumber}/reviews/${review.id}/comments`,
      ).then((raw) => raw.map((c) => ForgejoReviewComment.parse(c))),
    ),
  );

  const visibleReviewComments = reviewCommentLists
    .flat()
    .filter((c) => !c.user || !isIgnoredAuthor(c.user.login));

  // Nest each marked reply under the comment it answered, so a reply never
  // resurfaces as its own item. A status reaction can land on the root or on a
  // reply (a command can target a reply id from a printed reply URL), so status
  // is derived from every comment in the conversation.
  const conversations = groupReviewCommentConversations(visibleReviewComments);

  const reviewCommentItems = await Promise.all(
    conversations.map(async ({ root, replies }): Promise<FeedbackItem> => {
      const reactionLists = await Promise.all(
        [root, ...replies].map((c) => fetchReactions(slug, "review-comment", c.id)),
      );
      const reactions = reactionLists.flat();
      const normalized = normalizeForgejoReactions(reactions, viewer);
      return {
        id: root.id,
        timestamp: root.created_at,
        status: reactionToStatus(normalized, deriveIsDone(reactions, viewer)),
        author: root.user?.login ?? "ghost",
        location: formatLocation(root.path, reviewCommentLine(root)),
        body: root.body,
        responses: replies.map((reply) => ({
          author: reply.user?.login ?? "ghost",
          timestamp: reply.created_at,
          body: stripThreadReplyMarker(reply.body),
        })),
      };
    }),
  );

  const visibleIssueComments = issueComments.filter((c) => {
    if (c.body.trim().length === 0) {
      return false;
    }
    if (c.user && isIgnoredAuthor(c.user.login)) {
      return false;
    }
    // Drop our own generated replies so they don't resurface as new items.
    return !(c.user?.login === viewer && c.body.startsWith(FORGEJO_REPLY_MARKER));
  });

  const issueCommentItems = await Promise.all(
    visibleIssueComments.map(async (c): Promise<FeedbackItem> => {
      const reactions = await fetchReactions(slug, "issue-comment", c.id);
      const normalized = normalizeForgejoReactions(reactions, viewer);
      return {
        id: c.id,
        timestamp: c.created_at,
        status: reactionToStatus(normalized, deriveIsDone(reactions, viewer)),
        author: c.user?.login ?? "ghost",
        location: "",
        body: c.body,
        responses: [],
      };
    }),
  );

  // hideResolved: Forgejo has no resolved-thread axis, so its reaction-backed
  // equivalent is a done status (agreed/disagreed/acknowledged). hideHidden has
  // no Forgejo equivalent — nothing is ever minimized — so it filters nothing.
  const all = [...reviewCommentItems, ...issueCommentItems];
  const filtered = options.hideResolved ? all.filter((i) => !isStatusDone(i.status)) : all;

  const items = filtered.toSorted(
    (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime(),
  );

  return { prNumber, prUrl: pull.html_url, prTitle: pull.title, items };
}
