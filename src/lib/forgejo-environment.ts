/**
 * Forgejo environment helpers: authenticated user and current-branch PR lookup.
 *
 * Forgejo has no "current PR" shortcut (gh's `pr view`), so the branch's PR is
 * found by listing open pulls and matching head.ref to the checked-out branch.
 */

import * as z from "zod";
import { git } from "./git-helpers.js";
import { forgejoFetch, forgejoFetchAll } from "./forgejo-cli.js";
import { ForgejoPull } from "./forgejo-schemas.js";
import { selectForgejoPull } from "./select-forgejo-pull.js";

const ForgejoAuthenticatedUser = z.object({ login: z.string() });

let cachedViewer: string | undefined;

export async function getForgejoViewer(): Promise<string> {
  if (cachedViewer) {
    return cachedViewer;
  }
  const raw = await forgejoFetch<unknown>({ path: "user" });
  cachedViewer = ForgejoAuthenticatedUser.parse(raw).login;
  return cachedViewer;
}

function getCurrentBranch(): string {
  return git("rev-parse", "--abbrev-ref", "HEAD");
}

/**
 * Find the number of the open PR whose head is the current branch. The
 * client-side selection (head.ref + state + head-repo) is the authoritative
 * filter, and the pagination it walks is required: the `state`/`head` query
 * params are best-effort hints, so the match is re-verified client-side to avoid
 * returning a closed PR or a same-named branch from a different fork. See
 * selectForgejoPull for the disambiguation rationale.
 */
export async function findCurrentBranchPullNumber(slug: string): Promise<number> {
  const branch = getCurrentBranch();

  const raw = await forgejoFetchAll<unknown>(`repos/${slug}/pulls`, {
    state: "open",
    head: branch,
  });
  const selection = selectForgejoPull(
    raw.map((item) => ForgejoPull.parse(item)),
    branch,
    slug,
  );
  if (selection.kind === "one") {
    return selection.number;
  }
  if (selection.kind === "none") {
    throw new Error(
      `Error: No open pull request has branch '${branch}' as its head in ${slug}. Pass --pr <number> to select one.`,
    );
  }
  const numbers = selection.numbers.map((number) => `#${number}`).join(", ");
  throw new Error(
    `Error: ${selection.numbers.length} open pull requests have branch '${branch}' as their head in ${slug} (${numbers}). Pass --pr <number> to select one.`,
  );
}
