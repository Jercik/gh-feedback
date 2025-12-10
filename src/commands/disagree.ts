/**
 * Disagree command - mark item as "won't fix"
 *
 * Performs: reply + 👎 (thumbs_down) + resolve
 */

import type { Command } from "@commander-js/extra-typings";
import {
  readMessageFromFile,
  readMessageFromStdin,
} from "../lib/message-input.js";
import { getRepositoryInfo } from "../lib/github-environment.js";
import { exitWithMessage } from "../lib/git-helpers.js";
import { detectItemType } from "../lib/detect-item-type.js";
import {
  addReactionToItem,
  removeReactionFromItem,
} from "../lib/react-item.js";
import { replyToItem } from "../lib/reply-item.js";
import { resolveItem } from "../lib/resolve-item.js";
import { SUCCESS } from "../lib/tty-output.js";

export function registerDisagreeCommand(program: Command): void {
  program
    .command("disagree")
    .description(
      "Mark feedback as disagreed/won't fix (reply + thumbs_down + resolve)",
    )
    .argument("<id>", "The feedback item ID", (value) => {
      const id = Number.parseInt(value);
      if (Number.isNaN(id) || id <= 0) {
        exitWithMessage(`Error: Invalid ID "${value}".`);
      }
      return id;
    })
    .option("-m, --message <text>", "Reply message explaining why")
    .option("-f, --file <path>", "Read reply message from a file")
    .option("-n, --dry-run", "Preview without executing")
    .action(
      async (
        itemId: number,
        options: { message?: string; file?: string; dryRun?: boolean },
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
            message = await readMessageFromStdin("reply");
          }

          console.error(`Detecting item type for #${itemId}...`);
          const item = detectItemType(owner, repo, itemId);

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
          console.error("");
          console.error("Actions: reply + thumbs_down + resolve");

          if (options.dryRun) {
            console.error("Dry run: no changes made.");
            return;
          }

          // 1. Post reply
          console.error("Posting reply...");
          const reply = replyToItem(item, message);

          // 2. Remove eyes if present (cleanup in-progress state)
          try {
            removeReactionFromItem(item, "eyes");
          } catch {
            // Ignore if not present
          }

          // 3. Add thumbs_down
          console.error("Adding reaction...");
          addReactionToItem(item, "-1");

          // 4. Resolve
          console.error("Resolving...");
          resolveItem(item);

          console.error(`${SUCCESS} Marked #${itemId} as disagreed.`);
          console.log(reply.url);
        } catch (error) {
          exitWithMessage(
            error instanceof Error ? error.message : String(error),
          );
        }
      },
    );
}
