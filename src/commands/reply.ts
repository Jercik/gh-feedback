import type { Command } from "@commander-js/extra-typings";
import { registerMessageCommand } from "../lib/register-message-command.js";

export function registerReplyCommand(program: Command): void {
  registerMessageCommand(program, {
    name: "reply",
    description: "Reply to an item without changing its status (no reaction or resolution change)",
    messageHelp: "Reply message",
    messageNoun: "reply",
    actions: "reply (status unchanged)",
    done: (itemId) => `Replied to #${itemId}.`,
    status: undefined,
  });
}
