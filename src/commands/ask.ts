/**
 * Ask command - request clarification
 *
 * Performs: reply + 😕 (confused) - keeps item open
 */

import type { Command } from "@commander-js/extra-typings";
import { resolveMessage } from "../lib/message-input.js";
import { exitWithMessage } from "../lib/git-helpers.js";
import { resolveBackend } from "../lib/resolve-backend.js";
import { SUCCESS } from "../lib/tty-output.js";
import { verboseLog } from "../lib/verbose-mode.js";

export function registerAskCommand(program: Command): void {
  program
    .command("ask")
    .description("Request clarification (reply + confused, keeps open)")
    .argument("<id>", "The feedback item ID", (value) => {
      const id = Math.trunc(Number(value));
      if (Number.isNaN(id) || id <= 0) {
        exitWithMessage(`Error: Invalid ID "${value}".`);
      }
      return id;
    })
    .option("-m, --message <text>", "Question or clarification request")
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
          const message = await resolveMessage(options, "question");
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
          verboseLog("Question:");
          verboseLog("---");
          verboseLog(message);
          verboseLog("---");
          verboseLog("");
          verboseLog("Actions: reply + confused (item stays open)");

          if (options.dryRun) {
            console.error("Dry run: no changes made.");
            return;
          }

          // 1. Post reply
          verboseLog("Posting question...");
          const reply = await backend.reply(item, message);

          // 2-3: Status updates (best-effort after reply succeeds)
          try {
            // 2. Remove conflicting status reactions (only those we've added)
            await backend.removeReactions(item, viewerReactions, [
              "eyes", // in-progress
              "+1", // agreed
              "-1", // disagreed
              "rocket", // acknowledged
            ]);

            // 3. Add confused (item stays open for response)
            verboseLog("Adding reaction...");
            await backend.addReaction(item, "confused");
          } catch (statusError) {
            console.error(
              `Warning: Question posted, but status update failed: ${statusError instanceof Error ? statusError.message : String(statusError)}`,
            );
            console.error(`Reply URL: ${reply.url}`);
            // Continue - question was posted successfully
          }

          // Note: Do NOT resolve - item stays open awaiting reply

          verboseLog(`${SUCCESS} Asked for clarification on #${itemId}.`);
          console.log(reply.url);
        } catch (error) {
          exitWithMessage(error instanceof Error ? error.message : String(error));
        }
      },
    );
}
