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
import { forgejoFetch, forgejoFetchList } from "./forgejo-cli.js";
import { ForgejoIssueComment, ForgejoPull } from "./forgejo-schemas.js";
import { normalizeForgejoReactions, fetchReactions, deriveIsDone } from "./forgejo-reactions.js";
import { reviewCommentLine } from "./forgejo-review-comment-line.js";
import { groupReviewCommentConversations } from "./forgejo-conversations.js";
import { fetchPullReviewComments } from "./forgejo-pull-review-comments.js";
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

  const issueCommentsRaw = await forgejoFetchList<unknown>(
    `repos/${slug}/issues/${prNumber}/comments`,
  );
  const issueComments = issueCommentsRaw.map((c) => ForgejoIssueComment.parse(c));

  const reviewComments = await fetchPullReviewComments(slug, prNumber);
  const visibleReviewComments = reviewComments.filter(
    (c) => !c.user || !isIgnoredAuthor(c.user.login),
  );

  // Nest each marked reply under the comment it answered, so a reply never
  // resurfaces as its own item. Status lives on the conversation root: commands
  // canonicalize to it before reacting, so the root's reactions carry the status.
  const conversations = groupReviewCommentConversations(visibleReviewComments, viewer);

  const visibleConversations = options.hideResolved
    ? conversations.filter(({ root }) => !root.resolver)
    : conversations;
  const reviewCommentItems = await Promise.all(
    visibleConversations.map(async ({ root, replies }): Promise<FeedbackItem> => {
      const reactions = await fetchReactions(slug, "review-comment", root.id);
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

  // Inline conversations use native resolver state. Plain issue comments have
  // no such axis, so their reaction-backed final status remains the equivalent.
  const visibleIssueCommentItems = options.hideResolved
    ? issueCommentItems.filter((item) => !isStatusDone(item.status))
    : issueCommentItems;
  const filtered = [...reviewCommentItems, ...visibleIssueCommentItems];

  const items = filtered.toSorted(
    (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime(),
  );

  return { prNumber, prUrl: pull.html_url, prTitle: pull.title, items };
}
