/**
 * Disagree command - mark item as "won't fix"
 *
 * Performs: reply + 👎 (thumbs_down), leaving the conversation open
 */

import type { Command } from "@commander-js/extra-typings";
import { registerMessageCommand } from "../lib/register-message-command.js";

const actions = "reply + thumbs_down; reopens its inline conversation only if you resolved it";

export function registerDisagreeCommand(program: Command): void {
  registerMessageCommand(program, {
    name: "disagree",
    description: `Mark feedback as disagreed/won't fix (${actions})`,
    messageHelp: "Reply message explaining why",
    messageNoun: "reply",
    actions,
    done: (itemId) => `Marked #${itemId} as disagreed.`,
    status: "disagreed",
  });
}
