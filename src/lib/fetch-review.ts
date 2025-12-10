/**
 * Review fetching operations.
 */

import type { ReactionGroupNode, Reaction, ReviewState } from "./types.js";
import { ghJson } from "./github-cli.js";
import { getPullRequestNumber } from "./github-environment.js";
import { graphqlQuery, mapReactions } from "./github-graphql.js";
import { REVIEW_REACTIONS_QUERY } from "./graphql-queries.js";

export type ReviewDetail = {
  type: "review";
  id: number;
  author: string;
  state: ReviewState;
  url: string;
  submittedAt: string;
  body: string;
  reactions: Reaction[];
};

export function tryFetchReview(
  owner: string,
  repo: string,
  itemId: number,
): ReviewDetail | undefined {
  let prNumber: number | undefined;
  try {
    prNumber = getPullRequestNumber();
  } catch {
    prNumber = undefined;
  }

  if (!prNumber) return undefined;

  try {
    const reviewRest = ghJson<{
      id: number;
      node_id: string;
      user: { login: string };
      state: string;
      html_url: string;
      submitted_at: string;
      body: string;
    }>("api", `repos/${owner}/${repo}/pulls/${prNumber}/reviews/${itemId}`);

    const result = graphqlQuery<{
      data: { node: { reactionGroups: ReactionGroupNode[] } | null };
    }>(REVIEW_REACTIONS_QUERY, { id: reviewRest.node_id });
    const r = result.data.node;

    if (!r) return undefined;

    return {
      type: "review",
      id: reviewRest.id,
      author: reviewRest.user.login,
      state: reviewRest.state as ReviewState,
      url: reviewRest.html_url,
      submittedAt: reviewRest.submitted_at,
      body: reviewRest.body,
      reactions: mapReactions(r.reactionGroups),
    };
  } catch {
    return undefined;
  }
}
