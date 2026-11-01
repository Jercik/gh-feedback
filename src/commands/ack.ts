/**
 * Ack command - acknowledge informational item
 *
 * Performs: 🚀 (rocket) + resolve inline conversation
 * Used for bot summaries, status updates, or noise.
 */

import type { Command } from "@commander-js/extra-typings";
import { acknowledgeItem } from "../lib/acknowledge-item.js";
import { exitWithMessage } from "../lib/git-helpers.js";
import { resolveBackend } from "../lib/resolve-backend.js";
import { SUCCESS } from "../lib/tty-output.js";
import { verboseLog } from "../lib/verbose-mode.js";

export function registerAckCommand(program: Command): void {
  program
    .command("ack")
    .description("Acknowledge informational item (rocket + resolve inline conversation)")
    .argument("<id>", "The feedback item ID", (value) => {
      const id = Math.trunc(Number(value));
      if (Number.isNaN(id) || id <= 0) {
        exitWithMessage(`Error: Invalid ID "${value}".`);
      }
      return id;
    })
    .option("-n, --dry-run", "Preview without executing")
    .action(async (itemId: number, options: { dryRun?: boolean }) => {
      try {
        const { backend } = resolveBackend();

        verboseLog(`Detecting item type for #${itemId}...`);
        const item = await backend.detectItem(itemId);

        // Check if already in a done status - must use 'start' first
        const { doneStatus, viewerReactions } = await backend.getItemStatus(item);
        if (doneStatus) {
          exitWithMessage(
            `Error: Item #${itemId} is already "${doneStatus}". ` +
              `Use 'start' first to re-open it before changing status.`,
          );
        }

        verboseLog(`Found ${item.type} #${item.id} by @${item.author}`);
        if (item.path) {
          verboseLog(`Location: ${item.path}${item.line ? `:${item.line}` : ""}`);
        }

        verboseLog("");
        verboseLog("Actions: rocket + resolve inline conversation (acknowledge noise)");

        if (options.dryRun) {
          console.error("Dry run: no changes made.");
          return;
        }

        verboseLog("Updating reaction and completion state...");
        const completionResult = await acknowledgeItem(backend, item, viewerReactions);
        if (!completionResult.supported) {
          console.error(`Note: conversation resolution skipped - ${completionResult.reason}`);
        } else if (!completionResult.applied) {
          console.error(`Note: ${completionResult.reason}.`);
        }

        verboseLog(`${SUCCESS} Acknowledged #${itemId}.`);
      } catch (error) {
        exitWithMessage(error instanceof Error ? error.message : String(error));
      }
    });
}
