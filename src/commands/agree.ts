/**
 * Agree command - mark item as "fixed/agreed"
 *
 * Performs: reply + 👍 (thumbs_up) + resolve
 */

import type { Command } from "@commander-js/extra-typings";
import { readMessageFromFile, readMessageFromStdin } from "../lib/message-input.js";
import { exitWithMessage } from "../lib/git-helpers.js";
import { resolveBackend } from "../lib/resolve-backend.js";
import { SUCCESS } from "../lib/tty-output.js";
import { verboseLog } from "../lib/verbose-mode.js";

export function registerAgreeCommand(program: Command): void {
  program
    .command("agree")
    .description("Mark feedback as agreed/fixed (reply + thumbs_up + resolve)")
    .argument("<id>", "The feedback item ID", (value) => {
      const id = Math.trunc(Number(value));
      if (Number.isNaN(id) || id <= 0) {
        exitWithMessage(`Error: Invalid ID "${value}".`);
      }
      return id;
    })
    .option("-m, --message <text>", "Reply message (e.g., commit SHA)")
    .option("-f, --body-file <path>", "Read message from file (use - for stdin)")
    .option("-n, --dry-run", "Preview without executing")
    .option("-i, --interactive", "Allow typing message via stdin (Ctrl+D)")
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
          const { backend } = resolveBackend();

          // Get message
          let message: string;
          if (options.bodyFile) {
            message = await readMessageFromFile(options.bodyFile, "reply");
          } else if (options.message) {
            message = options.message;
          } else {
            if (process.stdin.isTTY && !options.interactive) {
              exitWithMessage(
                "Error: Missing reply message. Provide -m/--message, -f/--body-file, pipe via stdin, or pass --interactive to type it.",
              );
            }
            message = await readMessageFromStdin("reply");
          }

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
          await backend.blockIfUnresolvedSiblings(item, "agree with");

          verboseLog("");
          verboseLog("Actions: reply + thumbs_up + apply conversation policy");

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
              "-1", // disagreed
              "rocket", // acknowledged
              "confused", // awaiting-reply
            ]);

            // 3. Add thumbs_up
            verboseLog("Adding reaction...");
            await backend.addReaction(item, "+1");
            finalReactionAdded = true;

            // 4. Resolve the inline conversation, or report unsupported item types.
            verboseLog("Resolving...");
            const resolveResult = await backend.complete(item, "agreed");
            if (!resolveResult.supported) {
              console.error(`Note: resolve skipped - ${resolveResult.reason}`);
            } else if (!resolveResult.applied) {
              console.error(`Note: ${resolveResult.reason}.`);
            }
          } catch (statusError) {
            const statusMessage =
              statusError instanceof Error ? statusError.message : String(statusError);
            if (finalReactionAdded) {
              console.error(
                `Warning: Reply and thumbs-up reaction were recorded, but conversation resolution is unconfirmed: ${statusMessage}`,
              );
              console.error(
                "Do not run start + agree; inspect the native conversation and retry only its resolve transition if needed.",
              );
            } else {
              console.error(`Warning: Reply posted, but status update failed: ${statusMessage}`);
            }
            console.error(`Reply URL: ${reply.url}`);
            // Continue - reply was posted successfully
          }

          verboseLog(`${SUCCESS} Marked #${itemId} as agreed.`);
          console.log(reply.url);
        } catch (error) {
          exitWithMessage(error instanceof Error ? error.message : String(error));
        }
      },
    );
}
