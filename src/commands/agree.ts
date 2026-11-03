/**
 * Agree command - mark item as "fixed/agreed"
 */

import type { Command } from "@commander-js/extra-typings";
import { RESOLVES_CONVERSATION_WHEN_SETTLED } from "../lib/forgejo-conversation-guard.js";
import { registerMessageCommand } from "../lib/register-message-command.js";

const actions = `reply + thumbs_up; ${RESOLVES_CONVERSATION_WHEN_SETTLED}`;

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
