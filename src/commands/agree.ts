/**
 * Agree command - mark item as "fixed/agreed"
 *
 * Performs: reply + 👍 (thumbs_up) + resolve
 */

import type { Command } from "@commander-js/extra-typings";
import { registerMessageCommand } from "../lib/register-message-command.js";

export function registerAgreeCommand(program: Command): void {
  registerMessageCommand(program, {
    name: "agree",
    description: "Mark feedback as agreed/fixed (reply + thumbs_up + resolve)",
    messageHelp: "Reply message (e.g., commit SHA)",
    messageNoun: "reply",
    actions: "reply + thumbs_up + apply conversation policy",
    done: (itemId) => `Marked #${itemId} as agreed.`,
    status: "agreed",
  });
}
