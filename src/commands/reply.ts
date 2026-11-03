import type { Command } from "@commander-js/extra-typings";
import { resolveMessage } from "../lib/message-input.js";
import { exitWithMessage } from "../lib/git-helpers.js";
import { resolveBackend } from "../lib/resolve-backend.js";
import { SUCCESS } from "../lib/tty-output.js";
import { verboseLog } from "../lib/verbose-mode.js";

export function registerReplyCommand(program: Command): void {
  program
    .command("reply")
    .description("Reply to an item without changing its status (no reaction or resolution change)")
    .argument("<id>", "The feedback item ID", (value) => {
      const id = Math.trunc(Number(value));
      if (Number.isNaN(id) || id <= 0) {
        exitWithMessage(`Error: Invalid ID "${value}".`);
      }
      return id;
    })
    .option("-m, --message <text>", "Reply message")
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

          verboseLog(`Found ${item.type} #${item.id} by @${item.author}`);
          if (item.path) {
            verboseLog(`Location: ${item.path}${item.line ? `:${item.line}` : ""}`);
          }
          verboseLog("");
          verboseLog("Reply:");
          verboseLog("---");
          verboseLog(message);
          verboseLog("---");
          verboseLog("");
          verboseLog("Actions: reply (status unchanged)");

          if (options.dryRun) {
            console.error("Dry run: no changes made.");
            return;
          }

          verboseLog("Posting reply...");
          const reply = await backend.reply(item, message);

          verboseLog(`${SUCCESS} Replied to #${itemId}.`);
          console.log(reply.url);
        } catch (error) {
          exitWithMessage(error instanceof Error ? error.message : String(error));
        }
      },
    );
}
