/**
 * Disagree command - mark item as "won't fix"
 *
 * Performs: reply + 👎 (thumbs_down), leaving the conversation open
 */

import type { Command } from "@commander-js/extra-typings";
import { registerMessageCommand } from "../lib/register-message-command.js";

export function registerDisagreeCommand(program: Command): void {
  registerMessageCommand(program, {
    name: "disagree",
    description:
      "Mark feedback as disagreed/won't fix (reply + thumbs_down; conversation stays open)",
    messageHelp: "Reply message explaining why",
    messageNoun: "reply",
    actions:
      "reply + thumbs_down; keep the inline conversation open, reopening it if you resolved it",
    done: (itemId) => `Marked #${itemId} as disagreed.`,
    status: "disagreed",
  });
}
