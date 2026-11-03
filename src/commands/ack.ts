/**
 * Ack command - acknowledge informational item
 *
 * Used for bot summaries, status updates, or noise.
 */

import { reportCompletionResult } from "../lib/report-completion-result.js";
import type { Command } from "@commander-js/extra-typings";
import { acknowledgeItem } from "../lib/acknowledge-item.js";
import { getOpenItemReactions } from "../lib/get-open-item-reactions.js";
import { RESOLVES_CONVERSATION_WHEN_SETTLED } from "../lib/forgejo-conversation-guard.js";
import { exitWithMessage } from "../lib/git-helpers.js";
import { parseItemId } from "../lib/parse-item-id.js";
import { resolveBackend } from "../lib/resolve-backend.js";
import { SUCCESS } from "../lib/tty-output.js";
import { verboseLog } from "../lib/verbose-mode.js";

const actions = `rocket; ${RESOLVES_CONVERSATION_WHEN_SETTLED}`;

export function registerAckCommand(program: Command): void {
  program
    .command("ack")
    .description(`Acknowledge informational item (${actions})`)
    .argument("<id>", "The feedback item ID", parseItemId)
    .option("-n, --dry-run", "Preview without executing")
    .action(async (itemId: number, options: { dryRun?: boolean }) => {
      try {
        const { backend } = resolveBackend();

        verboseLog(`Detecting item type for #${itemId}...`);
        const item = await backend.detectItem(itemId);

        const viewerReactions = await getOpenItemReactions(backend, item);

        verboseLog(`Found ${item.type} #${item.id} by @${item.author}`);
        if (item.path) {
          verboseLog(`Location: ${item.path}${item.line ? `:${item.line}` : ""}`);
        }

        verboseLog("");
        verboseLog(`Actions: ${actions}`);

        if (options.dryRun) {
          console.error("Dry run: no changes made.");
          return;
        }

        verboseLog("Updating reaction and completion state...");
        const completionResult = await acknowledgeItem(backend, item, viewerReactions);
        reportCompletionResult(completionResult);

        verboseLog(`${SUCCESS} Acknowledged #${itemId}.`);
      } catch (error) {
        exitWithMessage(error instanceof Error ? error.message : String(error));
      }
    });
}
