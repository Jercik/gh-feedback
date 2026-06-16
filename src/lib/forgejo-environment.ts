/**
 * Forgejo environment helpers: authenticated user and current-PR resolution.
 *
 * Forgejo has no "current PR" shortcut (gh's `pr view`), so the current PR is
 * found by listing open pulls and matching head.ref to the checked-out branch.
 */

import * as z from "zod";
import { git } from "./git-helpers.js";
import { forgejoFetch, forgejoFetchAll } from "./forgejo-cli.js";
import { ForgejoPull } from "./forgejo-schemas.js";

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
 * Find the PR for the current branch. The client-side head.ref + state checks
 * are the authoritative filter (and the pagination they walk is required): the
 * `state`/`head` query params are treated as best-effort hints, so both are
 * re-verified client-side to avoid returning a closed PR that reused the branch
 * name. Returns undefined when no open PR has this branch as its head.
 */
export async function findForgejoPullByBranch(slug: string): Promise<ForgejoPull | undefined> {
  const branch = getCurrentBranch();

  const raw = await forgejoFetchAll<unknown>(`repos/${slug}/pulls`, {
    state: "open",
    head: branch,
  });
  for (const item of raw) {
    const pull = ForgejoPull.parse(item);
    if (pull.head?.ref === branch && pull.state === "open") {
      return pull;
    }
  }
  return undefined;
}
