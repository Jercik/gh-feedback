/**
 * Disagree command - mark item as "won't fix"
 */

import type { Command } from "@commander-js/extra-typings";
import { registerMessageCommand } from "../lib/register-message-command.js";

const actions =
  "reply + thumbs_down; leaves its inline conversation, if any, for the reviewer to settle, reopening it only if you resolved it";

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
