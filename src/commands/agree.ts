/**
 * Agree command - mark item as "fixed/agreed"
 *
 * Performs: reply + 👍 (thumbs_up) + resolve
 */

import type { Command } from "@commander-js/extra-typings";
import {
  readMessageFromFile,
  readMessageFromStdin,
} from "../lib/message-input.js";
import { getRepositoryInfo } from "../lib/github-environment.js";
import { exitWithMessage } from "../lib/git-helpers.js";
import { detectItemType } from "../lib/detect-item-type.js";
import { getItemStatus } from "../lib/fetch-item-status.js";
import { addReactionToItem, removeViewerReactions } from "../lib/react-item.js";
import { replyToItem } from "../lib/reply-item.js";
import { resolveItem } from "../lib/resolve-item.js";
import { blockIfUnresolvedSiblings } from "../lib/check-sibling-threads.js";
import { SUCCESS } from "../lib/tty-output.js";

export function registerAgreeCommand(program: Command): void {
  program
    .command("agree")
    .description("Mark feedback as agreed/fixed (reply + thumbs_up + resolve)")
    .argument("<id>", "The feedback item ID", (value) => {
      const id = Number.parseInt(value);
      if (Number.isNaN(id) || id <= 0) {
        exitWithMessage(`Error: Invalid ID "${value}".`);
      }
      return id;
    })
    .option("-m, --message <text>", "Reply message (e.g., commit SHA)")
    .option("-f, --file <path>", "Read reply message from a file")
    .option("-n, --dry-run", "Preview without executing")
    .option("-i, --interactive", "Allow typing message via stdin (Ctrl+D)")
    .action(
      async (
        itemId: number,
        options: {
          message?: string;
          file?: string;
          dryRun?: boolean;
          interactive?: boolean;
        },
      ) => {
        try {
          const { owner, repo } = getRepositoryInfo();

          // Get message
          let message: string;
          if (options.file) {
            message = await readMessageFromFile(options.file);
          } else if (options.message) {
            message = options.message;
          } else {
            if (process.stdin.isTTY && !options.interactive) {
              exitWithMessage(
                "Error: Missing reply message. Provide -m/--message, -f/--file, pipe via stdin, or pass --interactive to type it.",
              );
            }
            message = await readMessageFromStdin("reply");
          }

          console.error(`Detecting item type for #${itemId}...`);
          const item = detectItemType(owner, repo, itemId);

          // Check if already in a done status - must use 'start' first
          const { doneStatus, viewerReactions } = getItemStatus(item);
          if (doneStatus) {
            exitWithMessage(
              `Error: Item #${itemId} is already "${doneStatus}". ` +
                `Use 'start' first to re-open it before changing status.`,
            );
          }

          console.error(`Found ${item.type} #${item.id} by @${item.author}`);
          if (item.path) {
            console.error(
              `Location: ${item.path}${item.line ? `:${item.line}` : ""}`,
            );
          }
          console.error("");
          console.error("Reply:");
          console.error("---");
          console.error(message);
          console.error("---");
          // Check for unresolved sibling threads in multi-thread reviews
          blockIfUnresolvedSiblings(item, "agree with");

          console.error("");
          console.error("Actions: reply + thumbs_up + resolve");

          if (options.dryRun) {
            console.error("Dry run: no changes made.");
            return;
          }

          // 1. Post reply
          console.error("Posting reply...");
          const reply = replyToItem(item, message);

          // 2-4: Status updates (best-effort after reply succeeds)
          try {
            // 2. Remove conflicting status reactions (only those we've added)
            removeViewerReactions(item, viewerReactions, [
              "eyes", // in-progress
              "-1", // disagreed
              "rocket", // acknowledged
              "confused", // awaiting-reply
            ]);

            // 3. Add thumbs_up
            console.error("Adding reaction...");
            addReactionToItem(item, "+1");

            // 4. Resolve
            console.error("Resolving...");
            resolveItem(item);
          } catch (statusError) {
            console.error(
              `Warning: Reply posted, but status update failed: ${statusError instanceof Error ? statusError.message : String(statusError)}`,
            );
            console.error(`Reply URL: ${reply.url}`);
            // Continue - reply was posted successfully
          }

          console.error(`${SUCCESS} Marked #${itemId} as agreed.`);
          console.log(reply.url);
        } catch (error) {
          exitWithMessage(
            error instanceof Error ? error.message : String(error),
          );
        }
      },
    );
}
