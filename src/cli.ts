#!/usr/bin/env node
/**
 * gh-review.ts
 *
 * Unified CLI for GitHub pull request feedback operations.
 * Optimized for performance and reduced API usage.
 */

import { createProgram } from "./lib/create-program.js";
import {
  getRepositoryInfo,
  getPullRequestNumber,
} from "./lib/github-environment.js";
import { exitWithMessage } from "./lib/git-helpers.js";
import { fetchAllFeedback } from "./lib/fetch-feedback.js";
import { fetchItemDetail } from "./lib/fetch-item-detail.js";
import { formatAllFeedback, formatItemDetail } from "./lib/formatters.js";
import { registerReviewCommands } from "./commands/review.js";
import { registerCommentCommands } from "./commands/comment.js";
import { registerThreadCommands } from "./commands/thread.js";

// =============================================================================
// CLI Setup
// =============================================================================

const program = createProgram(
  "gh-review",
  "Interact with PR feedback on the current branch's pull request.",
);

program.addHelpText(
  "after",
  `
Example workflow:
  $ gh-review status                    # List all feedback (reviews, threads, comments)
  $ gh-review read 123456               # Read full details for item #123456
  $ gh-review thread react 123456 eyes  # Mark as "looking into it"
  $ gh-review thread reply 123456 -m 'Fixed in abc123'
  $ gh-review thread unreact 123456 eyes
  $ gh-review thread react 123456 +1    # Mark as done
  $ gh-review thread resolve 123456     # Close the thread
`,
);

// -----------------------------------------------------------------------------
// Top-Level Status Command (unified feedback view)
// -----------------------------------------------------------------------------

program
  .command("status")
  .description("Show PR feedback (reviews, threads, comments).")
  .option("--hide-hidden", "Exclude minimized items")
  .option("--hide-resolved", "Exclude resolved threads")
  .option("-j, --json", "Output results as JSON")
  .action(
    (options: {
      hideHidden?: boolean;
      hideResolved?: boolean;
      json?: boolean;
    }) => {
      try {
        const { owner, repo } = getRepositoryInfo();
        const prNumber = getPullRequestNumber();

        console.error(`Fetching all feedback for PR #${prNumber}...`);
        const feedback = fetchAllFeedback(owner, repo, prNumber, {
          hideHidden: options.hideHidden,
          hideResolved: options.hideResolved,
        });

        if (options.json) {
          console.log(JSON.stringify(feedback, undefined, 2));
        } else {
          console.log(formatAllFeedback(feedback));
        }
      } catch (error: unknown) {
        exitWithMessage(error instanceof Error ? error.message : String(error));
      }
    },
  );

// -----------------------------------------------------------------------------
// Read Command - Fetch Full Details for Individual Items
// -----------------------------------------------------------------------------

program
  .command("read")
  .description(
    "Fetch full details for a specific item (review, thread, or comment)",
  )
  .argument("<item-id>", "The item ID to fetch details for", (value) => {
    const id = Number.parseInt(value);
    if (Number.isNaN(id) || id <= 0) {
      exitWithMessage(`Error: Invalid item ID "${value}".`);
    }
    return id;
  })
  .option("-j, --json", "Output results as JSON")
  .action((itemId: number, options: { json?: boolean }) => {
    try {
      const { owner, repo } = getRepositoryInfo();

      console.error(`Fetching details for item #${itemId}...`);
      const item = fetchItemDetail(owner, repo, itemId);

      if (options.json) {
        console.log(JSON.stringify(item, undefined, 2));
      } else {
        console.log(formatItemDetail(item));
      }
    } catch (error: unknown) {
      exitWithMessage(error instanceof Error ? error.message : String(error));
    }
  });

// -----------------------------------------------------------------------------
// Register Subcommands
// -----------------------------------------------------------------------------

registerReviewCommands(program);
registerCommentCommands(program);
registerThreadCommands(program);

program.parse(process.argv);
