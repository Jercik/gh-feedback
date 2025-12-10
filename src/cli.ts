#!/usr/bin/env node
/**
 * gh-feedback - Semantic CLI for GitHub PR feedback workflow.
 *
 * Commands:
 *   summary    - Get all feedback context (TSV or pretty)
 *   detail     - Get full content of a single item
 *   start      - Mark item as work-in-progress
 *   agree      - Mark as agreed/fixed (reply + resolve)
 *   disagree   - Mark as disagreed/won't fix (reply + resolve)
 *   ask        - Request clarification (reply, stays open)
 *   ack        - Acknowledge noise (hide)
 */

import { createProgram } from "./lib/create-program.js";
import {
  getRepositoryInfo,
  getPullRequestNumber,
} from "./lib/github-environment.js";
import { exitWithMessage } from "./lib/git-helpers.js";
import { fetchSummary } from "./lib/fetch-summary.js";
import { formatSummary } from "./lib/format-summary.js";
import { registerStartCommand } from "./commands/start.js";
import { registerAgreeCommand } from "./commands/agree.js";
import { registerDisagreeCommand } from "./commands/disagree.js";
import { registerAskCommand } from "./commands/ask.js";
import { registerAckCommand } from "./commands/ack.js";
import { registerDetailCommand } from "./commands/detail.js";

// =============================================================================
// Signal Handlers
// =============================================================================

process.on("SIGINT", () => {
  console.error("\nInterrupted");
  process.exit(130); // 128 + 2 (SIGINT)
});

// =============================================================================
// CLI Setup
// =============================================================================

const program = createProgram();

program.addHelpText(
  "after",
  String.raw`
Example workflow:
  $ gh-feedback summary              # Get all feedback (pretty format)
  $ gh-feedback summary --porcelain  # Get all feedback (TSV for scripting)
  $ gh-feedback start 456            # Mark #456 as in-progress
  $ gh-feedback agree 456 -m 'Fixed in abc123'
  $ gh-feedback disagree 456 -m 'Intentional, see docs'
  $ gh-feedback ask 456 -m 'Could you clarify?'
  $ gh-feedback ack 789              # Acknowledge bot noise
  $ gh-feedback detail 456           # Get full untruncated content

Unix pipeline examples:
  $ gh-feedback summary | awk -F'\t' '$3 == "pending"'  # Filter by status
  $ gh-feedback summary | awk -F'\t' '$1 ~ /^123456$/'  # Filter by ID (use ~ not ==)
  $ gh-feedback summary | tail -n +2 | sort -t$'\t' -k3  # Sort by status
  $ gh-feedback summary --json 2>/dev/null | jq '.items[0]'  # JSON with jq
`,
);

// -----------------------------------------------------------------------------
// Summary Command - Primary context gathering
// -----------------------------------------------------------------------------

program
  .command("summary")
  .description("Get all PR feedback with semantic status")
  .option("--hide-hidden", "Exclude minimized items")
  .option("--hide-resolved", "Exclude resolved items")
  .option("-p, --porcelain", "Output as TSV (machine-readable)")
  .option("-j, --json", "Output as JSON")
  .action(
    (options: {
      hideHidden?: boolean;
      hideResolved?: boolean;
      porcelain?: boolean;
      json?: boolean;
    }) => {
      try {
        const { owner, repo } = getRepositoryInfo();
        const prNumber = getPullRequestNumber();

        console.error(`Fetching feedback for PR #${prNumber}...`);
        const summary = fetchSummary(owner, repo, prNumber, {
          hideHidden: options.hideHidden,
          hideResolved: options.hideResolved,
        });

        if (options.json) {
          console.log(JSON.stringify(summary, undefined, 2));
        } else {
          // Auto-detect: use TSV if not TTY or if --porcelain
          const useTsv = options.porcelain ?? !process.stdout.isTTY;
          console.log(formatSummary(summary, { porcelain: useTsv }));
        }
      } catch (error: unknown) {
        exitWithMessage(error instanceof Error ? error.message : String(error));
      }
    },
  );

// -----------------------------------------------------------------------------
// Register Semantic Commands
// -----------------------------------------------------------------------------

registerDetailCommand(program);
registerStartCommand(program);
registerAgreeCommand(program);
registerDisagreeCommand(program);
registerAskCommand(program);
registerAckCommand(program);

await program.parseAsync(process.argv);
