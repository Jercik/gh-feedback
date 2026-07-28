/**
 * Ack command - acknowledge informational item
 *
 * Performs: 🚀 (rocket) + hide/resolve
 * Used for bot summaries, status updates, or noise.
 */

import type { Command } from "@commander-js/extra-typings";
import { exitWithMessage } from "../lib/git-helpers.js";
import { resolveBackend } from "../lib/resolve-backend.js";
import { SUCCESS } from "../lib/tty-output.js";
import { verboseLog } from "../lib/verbose-mode.js";

export function registerAckCommand(program: Command): void {
  program
    .command("ack")
    .description("Acknowledge informational item (rocket + hide/resolve)")
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

        // Check for unresolved sibling threads in multi-thread reviews
        await backend.blockIfUnresolvedSiblings(item, "acknowledged", "ACK");

        verboseLog("");
        verboseLog("Actions: rocket + hide/resolve (acknowledge noise)");

        if (options.dryRun) {
          console.error("Dry run: no changes made.");
          return;
        }

        try {
          await backend.removeReactions(item, viewerReactions, [
            "eyes", // in-progress
            "+1", // agreed
            "-1", // disagreed
            "confused", // awaiting-reply
          ]);

          verboseLog("Adding reaction...");
          await backend.addReaction(item, "rocket");

          verboseLog("Hiding...");
          const hideResult = await backend.complete(item, "acknowledged");
          if (!hideResult.supported) {
            console.error(`Note: hide skipped - ${hideResult.reason}`);
          }
        } catch (statusError) {
          console.error(
            `Warning: Acknowledgement status update was only partially applied: ${statusError instanceof Error ? statusError.message : String(statusError)}`,
          );
        }

        verboseLog(`${SUCCESS} Acknowledged #${itemId}.`);
      } catch (error) {
        exitWithMessage(error instanceof Error ? error.message : String(error));
      }
    });
}
