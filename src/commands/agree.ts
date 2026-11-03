/**
 * Agree command - mark item as "fixed/agreed"
 *
 * Performs: reply + 👍 (thumbs_up) + resolve
 */

import { reportCompletionResult } from "../lib/report-completion-result.js";
import type { Command } from "@commander-js/extra-typings";
import { registerMessageCommand } from "../lib/register-message-command.js";
import { verboseLog } from "../lib/verbose-mode.js";

export function registerAgreeCommand(program: Command): void {
  registerMessageCommand(program, {
    name: "agree",
    description: "Mark feedback as agreed/fixed (reply + thumbs_up + resolve)",
    messageHelp: "Reply message (e.g., commit SHA)",
    prompt: "reply",
    actions: "reply + thumbs_up + apply conversation policy",
    done: (itemId) => `Marked #${itemId} as agreed.`,
    changeStatus: async ({ backend, item, viewerReactions, reply }) => {
      // Status updates are best-effort after the reply succeeds
      let finalReactionAdded = false;
      try {
        // Remove conflicting status reactions (only those we've added)
        await backend.removeReactions(item, viewerReactions, [
          "eyes", // in-progress
          "-1", // disagreed
          "rocket", // acknowledged
          "confused", // awaiting-reply
        ]);

        verboseLog("Adding reaction...");
        await backend.addReaction(item, "+1");
        finalReactionAdded = true;

        // Resolve the inline conversation when applicable.
        verboseLog("Resolving...");
        const resolveResult = await backend.complete(item, "agreed");
        reportCompletionResult(resolveResult);
        return true;
      } catch (statusError) {
        const statusMessage =
          statusError instanceof Error ? statusError.message : String(statusError);
        if (finalReactionAdded) {
          console.error(
            `Warning: Reply and thumbs-up reaction were recorded, but conversation resolution is unconfirmed: ${statusMessage}`,
          );
          console.error(
            "Do not repeat agree; inspect the item in the forge and retry only its expected conversation transition if needed.",
          );
          console.error(`Reply URL: ${reply.url}`);
          process.exitCode = 1;
          return false;
        }
        console.error(`Warning: Reply posted, but status update failed: ${statusMessage}`);
        console.error(
          "Do not repeat agree; inspect the item in the forge and complete its missing status changes manually.",
        );
        console.error(`Reply URL: ${reply.url}`);
        process.exitCode = 1;
        return false;
      }
    },
  });
}
