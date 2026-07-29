/**
 * Start command - mark item as "working on it"
 *
 * Adds 👀 (eyes) reaction to indicate work in progress.
 * Also reopens the item if it was resolved/hidden.
 */

import type { Command } from "@commander-js/extra-typings";
import { exitWithMessage } from "../lib/git-helpers.js";
import { resolveBackend } from "../lib/resolve-backend.js";
import { startItem } from "../lib/start-item.js";
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
        const { viewerReactions, isMinimized, isResolved, viewerMayReopen } =
          await backend.getItemStatus(item);

        // Reopen only when the backend says this viewer may do so. On Forgejo
        // that preserves another user's resolution; on GitHub every resolved
        // thread is reopenable. For non-thread items, hiding is a separate axis.
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
        await startItem(backend, item, viewerReactions, isMinimized, needsReopen);
        verboseLog(`${SUCCESS} Marked #${itemId} as in-progress.`);
      } catch (error) {
        exitWithMessage(error instanceof Error ? error.message : String(error));
      }
    });
}
