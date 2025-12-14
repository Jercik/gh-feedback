/**
 * Ack command - acknowledge informational item
 *
 * Performs: 🚀 (rocket) + hide
 * Used for bot summaries, status updates, or noise.
 */

import type { Command } from "@commander-js/extra-typings";
import { getRepositoryInfo } from "../lib/github-environment.js";
import { exitWithMessage } from "../lib/git-helpers.js";
import { detectItemType } from "../lib/detect-item-type.js";
import { getItemStatus } from "../lib/fetch-item-status.js";
import { addReactionToItem, removeViewerReactions } from "../lib/react-item.js";
import { resolveItem } from "../lib/resolve-item.js";
import { blockIfUnresolvedSiblings } from "../lib/check-sibling-threads.js";
import { SUCCESS } from "../lib/tty-output.js";
import { verboseLog } from "../lib/verbose-mode.js";

export function registerAckCommand(program: Command): void {
  program
    .command("ack")
    .description("Acknowledge informational item (rocket + hide)")
    .argument("<id>", "The feedback item ID", (value) => {
      const id = Number.parseInt(value);
      if (Number.isNaN(id) || id <= 0) {
        exitWithMessage(`Error: Invalid ID "${value}".`);
      }
      return id;
    })
    .option("-n, --dry-run", "Preview without executing")
    .action((itemId: number, options: { dryRun?: boolean }) => {
      try {
        const { owner, repo } = getRepositoryInfo();

        verboseLog(`Detecting item type for #${itemId}...`);
        const item = detectItemType(owner, repo, itemId);

        // Check if already in a done status - must use 'start' first
        const { doneStatus, viewerReactions } = getItemStatus(item);
        if (doneStatus) {
          exitWithMessage(
            `Error: Item #${itemId} is already "${doneStatus}". ` +
              `Use 'start' first to re-open it before changing status.`,
          );
        }

        verboseLog(`Found ${item.type} #${item.id} by @${item.author}`);
        if (item.path) {
          verboseLog(
            `Location: ${item.path}${item.line ? `:${item.line}` : ""}`,
          );
        }

        // Check for unresolved sibling threads in multi-thread reviews
        blockIfUnresolvedSiblings(item, "ACK");

        verboseLog("");
        verboseLog("Actions: rocket + hide (acknowledge noise)");

        if (options.dryRun) {
          console.error("Dry run: no changes made.");
          return;
        }

        // 1. Remove conflicting status reactions (only those we've added)
        removeViewerReactions(item, viewerReactions, [
          "eyes", // in-progress
          "+1", // agreed
          "-1", // disagreed
          "confused", // awaiting-reply
        ]);

        // 2. Add rocket
        verboseLog("Adding reaction...");
        addReactionToItem(item, "rocket");

        // 3. Hide/resolve
        verboseLog("Hiding...");
        resolveItem(item);

        verboseLog(`${SUCCESS} Acknowledged #${itemId}.`);
      } catch (error) {
        exitWithMessage(error instanceof Error ? error.message : String(error));
      }
    });
}
