/**
 * Agree command - mark item as "fixed/agreed"
 */

import type { Command } from "@commander-js/extra-typings";
import { registerMessageCommand } from "../lib/register-message-command.js";

export function registerAgreeCommand(program: Command): void {
  registerMessageCommand(program, {
    name: "agree",
    description:
      "Mark feedback as agreed/fixed (reply + thumbs_up; resolves its inline conversation once every item in it is agreed or acknowledged)",
    messageHelp: "Reply message (e.g., commit SHA)",
    messageNoun: "reply",
    actions:
      "reply + thumbs_up; resolve the inline conversation once every item in it is agreed or acknowledged",
    done: (itemId) => `Marked #${itemId} as agreed.`,
    status: "agreed",
  });
}
