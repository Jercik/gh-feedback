/**
 * Pick the open PR for the current branch from Forgejo's pulls list.
 *
 * Forgejo's `head` query filters by branch name only and ignores the head repo,
 * so two open PRs from different forks can share a branch name. The current
 * branch was pushed to origin (== slug), so the PR whose head repo is origin is
 * ours. When head-repo info is absent (AGit-flow PRs leave it unset) fall back
 * to the sole branch match, and refuse to guess when the match is ambiguous.
 */

import type { ForgejoPull } from "./forgejo-schemas.js";

export function selectForgejoPull(
  pulls: ForgejoPull[],
  branch: string,
  slug: string,
): ForgejoPull | undefined {
  const matches = pulls.filter((pull) => pull.head?.ref === branch && pull.state === "open");
  const ours = matches.find(
    (pull) => pull.head?.repo?.full_name?.toLowerCase() === slug.toLowerCase(),
  );
  if (ours) {
    return ours;
  }
  return matches.length === 1 ? matches[0] : undefined;
}
