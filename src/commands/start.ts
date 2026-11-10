/**
 * Start command - mark item as "working on it"
 *
 * Adds 👀 (eyes) reaction to indicate work in progress.
 * Also reopens its conversation if you resolved it.
 */

import type { Command } from "@commander-js/extra-typings";
import { exitWithMessage } from "../lib/git-helpers.js";
import { parseItemId } from "../lib/parse-item-id.js";
import { prOption, repoOption } from "../lib/feedback-target.js";
import { resolveBackend } from "../lib/resolve-backend.js";
import { startItem } from "../lib/start-item.js";
import { SUCCESS } from "../lib/tty-output.js";
import { verboseLog } from "../lib/verbose-mode.js";

export function registerStartCommand(program: Command): void {
  program
    .command("start")
    .description("Mark a feedback item as work-in-progress (adds eyes reaction)")
    .argument("<id>", "The feedback item ID", parseItemId)
    .option("-n, --dry-run", "Preview without executing")
    .addOption(repoOption())
    .addOption(prOption())
    .action(async (itemId, options) => {
      try {
        const { backend } = await resolveBackend(options);

        verboseLog(`Detecting item type for #${itemId}...`);
        const item = await backend.detectItem(itemId);
        const { doneStatus, viewerReactions, isResolved, viewerMayReopen } =
          await backend.getItemStatus(item);

        if (doneStatus === "dismissed" && (await backend.readServiceFinding(item)) !== undefined) {
          throw new Error(
            `Error: Item #${item.id} is dismissed with the review service. Use 'reopen ${item.id} -m <why>' to reconsider it.`,
          );
        }

        const needsReopen = viewerMayReopen;

        verboseLog(`Found ${item.type} #${item.id} by @${item.author}`);
        if (item.path) {
          verboseLog(`Location: ${item.path}${item.line ? `:${item.line}` : ""}`);
        }
        verboseLog("");
        if (needsReopen) {
          verboseLog("Actions: reopen + eyes reaction (in-progress)");
        } else {
          verboseLog("Action: add eyes reaction (in-progress)");
        }
        if (item.type === "thread" && isResolved && !viewerMayReopen) {
          console.error(
            "Note: reopen skipped - conversation resolution belongs to another user and was preserved.",
          );
        }

        if (options.dryRun) {
          console.error("Dry run: no changes made.");
          return;
        }

        if (needsReopen) {
          verboseLog("Reopening...");
        }
        await startItem(backend, item, viewerReactions, needsReopen);
        verboseLog(`${SUCCESS} Marked #${itemId} as in-progress.`);
      } catch (error) {
        exitWithMessage(error instanceof Error ? error.message : String(error));
      }
    });
}
