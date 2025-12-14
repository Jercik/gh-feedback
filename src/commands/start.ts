/**
 * Start command - mark item as "working on it"
 *
 * Adds 👀 (eyes) reaction to indicate work in progress.
 * Also reopens the item if it was resolved/hidden.
 */

import type { Command } from "@commander-js/extra-typings";
import { getRepositoryInfo } from "../lib/github-environment.js";
import { exitWithMessage } from "../lib/git-helpers.js";
import { detectItemType } from "../lib/detect-item-type.js";
import { getItemStatus } from "../lib/fetch-item-status.js";
import { addReactionToItem, removeViewerReactions } from "../lib/react-item.js";
import { unresolveItem } from "../lib/resolve-item.js";
import { SUCCESS } from "../lib/tty-output.js";
import { verboseLog } from "../lib/verbose-mode.js";

export function registerStartCommand(program: Command): void {
  program
    .command("start")
    .description(
      "Mark a feedback item as work-in-progress (adds eyes reaction)",
    )
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
        const { viewerReactions, isMinimized } = getItemStatus(item);

        // Check if item needs reopening
        const needsReopen = item.isResolved || isMinimized;

        verboseLog(`Found ${item.type} #${item.id} by @${item.author}`);
        if (item.path) {
          verboseLog(
            `Location: ${item.path}${item.line ? `:${item.line}` : ""}`,
          );
        }
        verboseLog("");
        if (needsReopen) {
          verboseLog("Actions: reopen + eyes reaction (in-progress)");
        } else {
          verboseLog("Action: add eyes reaction (in-progress)");
        }

        if (options.dryRun) {
          console.error("Dry run: no changes made.");
          return;
        }

        // Reopen the item if it was resolved/hidden
        if (needsReopen) {
          verboseLog("Reopening...");
          unresolveItem(item, isMinimized);
        }

        // Remove conflicting status reactions (only those we've added)
        removeViewerReactions(item, viewerReactions, [
          "+1", // agreed
          "-1", // disagreed
          "rocket", // acknowledged
          "confused", // awaiting-reply
        ]);

        addReactionToItem(item, "eyes");
        verboseLog(`${SUCCESS} Marked #${itemId} as in-progress.`);
      } catch (error) {
        exitWithMessage(error instanceof Error ? error.message : String(error));
      }
    });
}
