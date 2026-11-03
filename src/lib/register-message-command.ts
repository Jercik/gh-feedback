import type { Command } from "@commander-js/extra-typings";
import type { FeedbackBackend, FeedbackItemRef, ReplyResult } from "./feedback-backend.js";
import { exitWithMessage } from "./git-helpers.js";
import { resolveMessage } from "./message-input.js";
import { parseItemId } from "./parse-item-id.js";
import { resolveBackend } from "./resolve-backend.js";
import { SUCCESS } from "./tty-output.js";
import type { ReactionContent } from "./types.js";
import { verboseLog } from "./verbose-mode.js";

interface PostedReply {
  backend: FeedbackBackend;
  item: FeedbackItemRef;
  viewerReactions: ReactionContent[];
  reply: ReplyResult;
}

/** Resolves false after reporting a failure that leaves the command unfinished. */
type ChangeStatus = (posted: PostedReply) => Promise<boolean>;

interface MessageCommand {
  name: string;
  description: string;
  messageHelp: string;
  prompt: string;
  actions: string;
  done: (itemId: number) => string;
  // A status change refuses an item that is already done, so a reply-only
  // command (undefined) is the one way to comment on a settled item.
  changeStatus: ChangeStatus | undefined;
}

async function openItemReactions(
  backend: FeedbackBackend,
  item: FeedbackItemRef,
): Promise<ReactionContent[]> {
  const { doneStatus, viewerReactions } = await backend.getItemStatus(item);
  if (doneStatus) {
    exitWithMessage(
      `Error: Item #${item.id} is already "${doneStatus}". ` +
        `Use 'start' first to re-open it before changing status.`,
    );
  }
  return viewerReactions;
}

function previewReply(item: FeedbackItemRef, command: MessageCommand, message: string): void {
  verboseLog(`Found ${item.type} #${item.id} by @${item.author}`);
  if (item.path) {
    verboseLog(`Location: ${item.path}${item.line ? `:${item.line}` : ""}`);
  }
  verboseLog("");
  verboseLog(`${command.prompt.charAt(0).toUpperCase()}${command.prompt.slice(1)}:`);
  verboseLog("---");
  verboseLog(message);
  verboseLog("---");
  verboseLog("");
  verboseLog(`Actions: ${command.actions}`);
}

export function registerMessageCommand(program: Command, command: MessageCommand): void {
  program
    .command(command.name)
    .description(command.description)
    .argument("<id>", "The feedback item ID", parseItemId)
    .option("-m, --message <text>", command.messageHelp)
    .option("-f, --body-file <path>", "Read message from file (use - for stdin)")
    .option("-n, --dry-run", "Preview without executing")
    .option("-i, --interactive", "Type the message on stdin (Ctrl+D to finish)")
    .action(async (itemId, options) => {
      try {
        const message = await resolveMessage(options, command.prompt);
        const { backend } = resolveBackend();

        verboseLog(`Detecting item type for #${itemId}...`);
        const item = await backend.detectItem(itemId);
        const { changeStatus } = command;
        const viewerReactions = changeStatus ? await openItemReactions(backend, item) : [];

        previewReply(item, command, message);
        if (options.dryRun) {
          console.error("Dry run: no changes made.");
          return;
        }

        verboseLog(`Posting ${command.prompt}...`);
        const reply = await backend.reply(item, message);
        if (changeStatus && !(await changeStatus({ backend, item, viewerReactions, reply }))) {
          return;
        }

        verboseLog(`${SUCCESS} ${command.done(itemId)}`);
        console.log(reply.url);
      } catch (error) {
        exitWithMessage(error instanceof Error ? error.message : String(error));
      }
    });
}
