/**
 * Disagree command - mark item as "won't fix"
 *
 * Performs: reply + 👎 (thumbs_down), then resolves on GitHub only
 */

import type { Command } from "@commander-js/extra-typings";
import { resolveMessage } from "../lib/message-input.js";
import { exitWithMessage } from "../lib/git-helpers.js";
import { resolveBackend } from "../lib/resolve-backend.js";
import { SUCCESS } from "../lib/tty-output.js";
import { verboseLog } from "../lib/verbose-mode.js";

export function registerDisagreeCommand(program: Command): void {
  program
    .command("disagree")
    .description(
      "Mark feedback as disagreed/won't fix (reply + thumbs_down + resolve; Forgejo stays open)",
    )
    .argument("<id>", "The feedback item ID", (value) => {
      const id = Math.trunc(Number(value));
      if (Number.isNaN(id) || id <= 0) {
        exitWithMessage(`Error: Invalid ID "${value}".`);
      }
      return id;
    })
    .option("-m, --message <text>", "Reply message explaining why")
    .option("-f, --body-file <path>", "Read message from file (use - for stdin)")
    .option("-n, --dry-run", "Preview without executing")
    .option("-i, --interactive", "Type the message on stdin (Ctrl+D to finish)")
    .action(
      async (
        itemId: number,
        options: {
          message?: string;
          bodyFile?: string;
          dryRun?: boolean;
          interactive?: boolean;
        },
      ) => {
        try {
          const message = await resolveMessage(options, "reply");
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
          verboseLog("Reply:");
          verboseLog("---");
          verboseLog(message);
          verboseLog("---");

          // Check for unresolved sibling threads in multi-thread reviews
          await backend.blockIfUnresolvedSiblings(item, "disagree with");

          verboseLog("");
          verboseLog("Actions: reply + thumbs_down + apply conversation policy");

          if (options.dryRun) {
            console.error("Dry run: no changes made.");
            return;
          }

          // 1. Post reply
          verboseLog("Posting reply...");
          const reply = await backend.reply(item, message);

          // 2-4: Status updates (best-effort after reply succeeds)
          let finalReactionAdded = false;
          try {
            // 2. Remove conflicting status reactions (only those we've added)
            await backend.removeReactions(item, viewerReactions, [
              "eyes", // in-progress
              "+1", // agreed
              "rocket", // acknowledged
              "confused", // awaiting-reply
            ]);

            // 3. Add thumbs_down
            verboseLog("Adding reaction...");
            await backend.addReaction(item, "-1");
            finalReactionAdded = true;

            verboseLog("Applying conversation policy...");
            const completionResult = await backend.complete(item, "disagreed");
            if (!completionResult.supported) {
              console.error(`Note: completion skipped - ${completionResult.reason}`);
            } else if (!completionResult.applied) {
              console.error(`Note: ${completionResult.reason}.`);
            }
          } catch (statusError) {
            const statusMessage =
              statusError instanceof Error ? statusError.message : String(statusError);
            if (finalReactionAdded) {
              console.error(
                `Warning: Reply and thumbs-down reaction were recorded, but the conversation state for this outcome is unconfirmed: ${statusMessage}`,
              );
              console.error(
                "Do not repeat disagree; inspect the item in the forge and retry only its expected conversation transition if needed.",
              );
              console.error(`Reply URL: ${reply.url}`);
              process.exitCode = 1;
              return;
            }
            console.error(`Warning: Reply posted, but status update failed: ${statusMessage}`);
            console.error(
              "Do not repeat disagree; inspect the item in the forge and complete its missing status changes manually.",
            );
            console.error(`Reply URL: ${reply.url}`);
            process.exitCode = 1;
            return;
          }

          verboseLog(`${SUCCESS} Marked #${itemId} as disagreed.`);
          console.log(reply.url);
        } catch (error) {
          exitWithMessage(error instanceof Error ? error.message : String(error));
        }
      },
    );
}
