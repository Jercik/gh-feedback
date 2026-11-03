/**
 * Agree command - mark item as "fixed/agreed"
 */

import type { Command } from "@commander-js/extra-typings";
import { registerMessageCommand } from "../lib/register-message-command.js";

const actions =
  "reply + thumbs_up; resolves its inline conversation, if any, once every item in it is agreed or acknowledged";

export function registerAgreeCommand(program: Command): void {
  registerMessageCommand(program, {
    name: "agree",
    description: `Mark feedback as agreed/fixed (${actions})`,
    messageHelp: "Reply message (e.g., commit SHA)",
    messageNoun: "reply",
    actions,
    done: (itemId) => `Marked #${itemId} as agreed.`,
    status: "agreed",
  });
}
