/**
 * Ask command - request clarification
 *
 * Performs: reply + 😕 (confused) - keeps item open
 */

import type { Command } from "@commander-js/extra-typings";
import { registerMessageCommand } from "../lib/register-message-command.js";
import { verboseLog } from "../lib/verbose-mode.js";

export function registerAskCommand(program: Command): void {
  registerMessageCommand(program, {
    name: "ask",
    description: "Request clarification (reply + confused, keeps open)",
    messageHelp: "Question or clarification request",
    prompt: "question",
    actions: "reply + confused (item stays open)",
    done: (itemId) => `Asked for clarification on #${itemId}.`,
    changeStatus: async ({ backend, item, viewerReactions, reply }) => {
      // Status updates are best-effort after the question is posted
      try {
        // Remove conflicting status reactions (only those we've added)
        await backend.removeReactions(item, viewerReactions, [
          "eyes", // in-progress
          "+1", // agreed
          "-1", // disagreed
          "rocket", // acknowledged
        ]);

        // Add confused (item stays open for response)
        verboseLog("Adding reaction...");
        await backend.addReaction(item, "confused");
      } catch (statusError) {
        console.error(
          `Warning: Question posted, but status update failed: ${statusError instanceof Error ? statusError.message : String(statusError)}`,
        );
        console.error(`Reply URL: ${reply.url}`);
      }

      // Do NOT resolve - item stays open awaiting reply
      return true;
    },
  });
}
