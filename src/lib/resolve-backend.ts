import { git, exitWithMessage } from "./git-helpers.js";
import { detectProvider } from "./provider.js";
import { createForgejoBackend } from "./forgejo-backend.js";
import { findForgejoPullByBranch } from "./forgejo-environment.js";
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
        `Supported: code.j4k.dev, code.tail.j4k.dev.`,
    );
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
