import type { Command } from "@commander-js/extra-typings";
import type { FeedbackBackend, FeedbackItemRef, FeedbackOutcome } from "./feedback-backend.js";
import type { FindingStatus } from "./feedback-types.js";
import { getOpenItemReactions } from "./get-open-item-reactions.js";
import { exitWithMessage } from "./git-helpers.js";
import { resolveMessage } from "./message-input.js";
import { parseItemId } from "./parse-item-id.js";
import { reportCompletionResult } from "./report-completion-result.js";
import { resolveBackend } from "./resolve-backend.js";
import { setStatus } from "./set-status.js";
import { SUCCESS } from "./tty-output.js";
import type { ReactionContent } from "./types.js";
import { verboseLog } from "./verbose-mode.js";

type MessageStatus = Extract<FindingStatus, "agreed" | "disagreed" | "awaiting-reply">;

const completionOutcomes: Record<MessageStatus, FeedbackOutcome | undefined> = {
  agreed: "agreed",
  disagreed: "disagreed",
  "awaiting-reply": undefined,
};

interface MessageCommand {
  name: string;
  description: string;
  messageHelp: string;
  // A lowercase singular noun ("reply", "question") that reads correctly mid-sentence and,
  // capitalized, at the start of one.
  messageNoun: string;
  actions: string;
  done: (itemId: number) => string;
  // Setting a status refuses an item that is already done, so a reply-only command (undefined) is
  // the one way to comment on a settled item.
  status: MessageStatus | undefined;
}

function capitalize(word: string): string {
  return `${word.charAt(0).toUpperCase()}${word.slice(1)}`;
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function previewReply(item: FeedbackItemRef, command: MessageCommand, message: string): void {
  verboseLog(`Found ${item.type} #${item.id} by @${item.author}`);
  if (item.path) {
    verboseLog(`Location: ${item.path}${item.line ? `:${item.line}` : ""}`);
  }
  verboseLog("");
  verboseLog(`${capitalize(command.messageNoun)}:`);
  verboseLog("---");
  verboseLog(message);
  verboseLog("---");
  verboseLog("");
  verboseLog(`Actions: ${command.actions}`);
}

// Resolves false after warning that the posted reply left the item's status unfinished.
async function changeStatus(
  backend: FeedbackBackend,
  item: FeedbackItemRef,
  viewerReactions: ReactionContent[],
  command: MessageCommand,
  status: MessageStatus,
): Promise<boolean> {
  const outcome = completionOutcomes[status];
  const posted = capitalize(command.messageNoun);
  try {
    verboseLog("Adding reaction...");
    await setStatus(backend, item, viewerReactions, status);
  } catch (error) {
    console.error(`Warning: ${posted} posted, but status update failed: ${errorMessage(error)}`);
    console.error(
      `Do not repeat ${command.name}; inspect the item in the forge and complete its missing status changes manually.`,
    );
    return false;
  }
  if (outcome === undefined) {
    return true;
  }
  try {
    verboseLog("Applying conversation policy...");
    reportCompletionResult(await backend.complete(item, outcome));
    return true;
  } catch (error) {
    console.error(
      `Warning: ${posted} posted and status set to ${status}, but the conversation state for this outcome is unconfirmed: ${errorMessage(error)}`,
    );
    console.error(
      `Do not repeat ${command.name}; inspect the item in the forge and retry only its expected conversation transition if needed.`,
    );
    return false;
  }
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
        const message = await resolveMessage(options, command.messageNoun);
        const { backend } = resolveBackend();

        verboseLog(`Detecting item type for #${itemId}...`);
        const item = await backend.detectItem(itemId);
        const { status } = command;
        const viewerReactions = status ? await getOpenItemReactions(backend, item) : [];

        previewReply(item, command, message);
        if (options.dryRun) {
          console.error("Dry run: no changes made.");
          return;
        }

        verboseLog(`Posting ${command.messageNoun}...`);
        const reply = await backend.reply(item, message);
        if (status && !(await changeStatus(backend, item, viewerReactions, command, status))) {
          console.error(`Reply URL: ${reply.url}`);
          process.exitCode = 1;
          return;
        }

        verboseLog(`${SUCCESS} ${command.done(itemId)}`);
        console.log(reply.url);
      } catch (error) {
        exitWithMessage(errorMessage(error));
      }
    });
}
