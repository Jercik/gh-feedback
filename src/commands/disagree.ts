/**
 * Disagree command - mark item as "won't fix"
 *
 * Performs: reply + 👎 (thumbs_down), leaving the conversation open
 */

import { reportCompletionResult } from "../lib/report-completion-result.js";
import type { Command } from "@commander-js/extra-typings";
import { registerMessageCommand } from "../lib/register-message-command.js";
import { verboseLog } from "../lib/verbose-mode.js";

export function registerDisagreeCommand(program: Command): void {
  registerMessageCommand(program, {
    name: "disagree",
    description:
      "Mark feedback as disagreed/won't fix (reply + thumbs_down; conversation stays open)",
    messageHelp: "Reply message explaining why",
    prompt: "reply",
    actions: "reply + thumbs_down + apply conversation policy",
    done: (itemId) => `Marked #${itemId} as disagreed.`,
    changeStatus: async ({ backend, item, viewerReactions, reply }) => {
      // Status updates are best-effort after the reply succeeds
      let finalReactionAdded = false;
      try {
        // Remove conflicting status reactions (only those we've added)
        await backend.removeReactions(item, viewerReactions, [
          "eyes", // in-progress
          "+1", // agreed
          "rocket", // acknowledged
          "confused", // awaiting-reply
        ]);

        verboseLog("Adding reaction...");
        await backend.addReaction(item, "-1");
        finalReactionAdded = true;

        verboseLog("Applying conversation policy...");
        const completionResult = await backend.complete(item, "disagreed");
        reportCompletionResult(completionResult);
        return true;
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
          return false;
        }
        console.error(`Warning: Reply posted, but status update failed: ${statusMessage}`);
        console.error(
          "Do not repeat disagree; inspect the item in the forge and complete its missing status changes manually.",
        );
        console.error(`Reply URL: ${reply.url}`);
        process.exitCode = 1;
        return false;
      }
    },
  });
}
