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
import type { PullSelection } from "./select-forgejo-pull.js";

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
 * Select the open PR whose head is the current branch. The client-side
 * selection is the authoritative filter, and the pagination it walks is
 * required: the `state`/`head` query params are best-effort hints, so the match
 * is re-verified client-side. See selectForgejoPull for the matching and
 * disambiguation rules.
 */
export async function selectCurrentBranchPull(
  slug: string,
): Promise<{ branch: string; selection: PullSelection }> {
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
  return { branch, selection };
}
