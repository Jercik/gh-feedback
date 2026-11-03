#!/usr/bin/env node
import { registerSnapshotCommand } from "./commands/snapshot.js";
/**
 * pr-feedback - Semantic CLI for PR feedback workflow (Forgejo).
 */

import { createProgram } from "./lib/create-program.js";
import { exitWithMessage } from "./lib/git-helpers.js";
import { resolveBackend } from "./lib/resolve-backend.js";
import { formatSummary } from "./lib/format-summary.js";
import { registerStartCommand } from "./commands/start.js";
import { registerAgreeCommand } from "./commands/agree.js";
import { registerDisagreeCommand } from "./commands/disagree.js";
import { registerAskCommand } from "./commands/ask.js";
import { registerAckCommand } from "./commands/ack.js";
import { registerReplyCommand } from "./commands/reply.js";
import { registerDetailCommand } from "./commands/detail.js";
import { verboseLog } from "./lib/verbose-mode.js";

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
  $ pr-feedback summary              # Get all feedback (pretty format)
  $ pr-feedback summary --porcelain  # Get all feedback (TSV for scripting)
  $ pr-feedback start 456            # Mark #456 as in-progress
  $ pr-feedback agree 456 -m 'Fixed in abc123'
  $ pr-feedback disagree 456 -m 'Intentional, see docs'
  $ pr-feedback ask 456 -m 'Could you clarify?'
  $ pr-feedback ack 789              # Acknowledge bot noise
  $ pr-feedback reply 456 -m 'Tracked in #12'  # Reply without changing status
  $ pr-feedback detail 456           # Get full untruncated content

Unix pipeline examples:
  $ pr-feedback summary | awk -F'\t' '$3 == "pending"'  # Filter by status
  $ pr-feedback summary | awk -F'\t' '$1 ~ /^123456$/'  # Filter by ID (use ~ not ==)
  $ pr-feedback summary | tail -n +2 | sort -t$'\t' -k3  # Sort by status
  $ pr-feedback summary --json 2>/dev/null | jq '.items[0]'  # JSON with jq
`,
);

// -----------------------------------------------------------------------------
// Summary Command - Primary context gathering
// -----------------------------------------------------------------------------

program
  .command("summary")
  .description("Get all PR feedback with semantic status")
  .option("--hide-resolved", "Exclude resolved items")
  .option("-p, --porcelain", "Output as TSV (auto-detected when stdout is not a TTY)")
  .option("-j, --json", "Output as JSON")
  .action(async (options: { hideResolved?: boolean; porcelain?: boolean; json?: boolean }) => {
    try {
      const { backend, currentPrNumber } = resolveBackend();
      const prNumber = await currentPrNumber();

      verboseLog(`Fetching feedback for PR #${prNumber}...`);
      const summary = await backend.fetchSummary(prNumber, {
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
  });

// -----------------------------------------------------------------------------
// Register Semantic Commands
// -----------------------------------------------------------------------------

registerSnapshotCommand(program);
registerDetailCommand(program);
registerStartCommand(program);
registerAgreeCommand(program);
registerDisagreeCommand(program);
registerAskCommand(program);
registerAckCommand(program);
registerReplyCommand(program);

async function main(): Promise<void> {
  await program.parseAsync(process.argv);
}

// Called from a plain function: the repo's lint config forbids both a
// top-level await and a top-level call to an async function.
function start(): void {
  void main();
}

start();
