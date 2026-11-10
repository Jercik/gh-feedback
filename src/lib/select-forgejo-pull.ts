/**
 * Select the open PR for a branch from Forgejo's pulls list.
 *
 * Forgejo's `head` query filters by branch name only and ignores the head repo,
 * so two open PRs from different forks can share a branch name. The current
 * branch was pushed to origin (== slug), so the PR whose head repo is origin is
 * ours. When head-repo info is absent (AGit-flow PRs leave it unset) fall back
 * to the sole branch match. One branch can also head several open PRs of origin
 * with different bases, so every candidate is reported when the match is ambiguous.
 */

import type { ForgejoPull } from "./forgejo-schemas.js";

export type PullSelection =
  | { kind: "one"; number: number }
  | { kind: "none" }
  | { kind: "many"; numbers: number[] };

export function selectForgejoPull(
  pulls: ForgejoPull[],
  branch: string,
  slug: string,
): PullSelection {
  const matches = pulls.filter((pull) => pull.head?.ref === branch && pull.state === "open");
  const ours = matches.filter(
    (pull) => pull.head?.repo?.full_name?.toLowerCase() === slug.toLowerCase(),
  );
  const candidates = ours.length > 0 ? ours : matches;
  const [only, ...rest] = candidates;
  if (!only) {
    return { kind: "none" };
  }
  return rest.length === 0
    ? { kind: "one", number: only.number }
    : { kind: "many", numbers: candidates.map((pull) => pull.number) };
}
