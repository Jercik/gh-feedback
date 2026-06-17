/**
 * Resolve the active forge backend from the origin remote.
 *
 * github.com  -> gh + GraphQL backend (unchanged)
 * code.j4k.dev / code.tail.j4k.dev -> Forgejo REST backend
 * anything else -> exit with a clear message (no backend to fake)
 */

import { git, exitWithMessage } from "./git-helpers.js";
import { detectProvider } from "./provider.js";
import { createGithubBackend } from "./github-backend.js";
import { createForgejoBackend } from "./forgejo-backend.js";
import { findForgejoPullByBranch } from "./forgejo-environment.js";
import { getPullRequestNumber } from "./github-environment.js";
import type { FeedbackBackend } from "./feedback-backend.js";

interface ResolvedBackend {
  backend: FeedbackBackend;
  /** Resolve the current branch's PR number (provider-specific lookup). */
  currentPrNumber: () => Promise<number>;
}

export function resolveBackend(): ResolvedBackend {
  const originUrl = git("remote", "get-url", "origin");
  const info = detectProvider(originUrl);

  if (!info) {
    return exitWithMessage(
      `Error: Unsupported git host for origin '${originUrl}'. ` +
        `Supported: github.com, code.j4k.dev, code.tail.j4k.dev.`,
    );
  }

  if (info.provider === "github") {
    return {
      backend: createGithubBackend(info.owner, info.repo),
      currentPrNumber: () => Promise.resolve(getPullRequestNumber()),
    };
  }

  const slug = info.slug;
  return {
    backend: createForgejoBackend(slug),
    currentPrNumber: async () => {
      const pull = await findForgejoPullByBranch(slug);
      if (!pull) {
        return exitWithMessage("Error: No open Forgejo pull request found for the current branch.");
      }
      return pull.number;
    },
  };
}
