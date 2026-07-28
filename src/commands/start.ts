/**
 * Start command - mark item as "working on it"
 *
 * Adds 👀 (eyes) reaction to indicate work in progress.
 * Also reopens the item if it was resolved/hidden.
 */

import type { Command } from "@commander-js/extra-typings";
import { exitWithMessage } from "../lib/git-helpers.js";
import { resolveBackend } from "../lib/resolve-backend.js";
import { SUCCESS } from "../lib/tty-output.js";
import { verboseLog } from "../lib/verbose-mode.js";

export function registerStartCommand(program: Command): void {
  program
    .command("start")
    .description("Mark a feedback item as work-in-progress (adds eyes reaction)")
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
        const { viewerReactions, isMinimized, viewerMayReopen } = await backend.getItemStatus(item);

        // Reopen if resolved, or (for comments and review containers, which can
        // carry a thread's resolved flag) if hidden. A thread's minimized flag is
        // independent of its resolved state, so for threads the resolved flag
        // alone is authoritative and minimizing must not force a reopen.
        const needsReopen = viewerMayReopen || (item.type !== "thread" && isMinimized);

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

        if (options.dryRun) {
          console.error("Dry run: no changes made.");
          return;
        }

        // Reopen the item if it was resolved/hidden
        if (needsReopen) {
          verboseLog("Reopening...");
          const result = await backend.unresolve(item, isMinimized);
          if (!result.supported) {
            console.error(`Note: reopen skipped - ${result.reason}`);
          }
        }

        // Remove conflicting status reactions (only those we've added)
        await backend.removeReactions(item, viewerReactions, [
          "+1", // agreed
          "-1", // disagreed
          "rocket", // acknowledged
          "confused", // awaiting-reply
        ]);

        await backend.addReaction(item, "eyes");
        verboseLog(`${SUCCESS} Marked #${itemId} as in-progress.`);
      } catch (error) {
        exitWithMessage(error instanceof Error ? error.message : String(error));
      }
    });
}
