/**
 * Ask command - request clarification
 *
 * Performs: reply + 😕 (confused) - keeps item open
 */

import type { Command } from "@commander-js/extra-typings";
import { registerMessageCommand } from "../lib/register-message-command.js";

export function registerAskCommand(program: Command): void {
  registerMessageCommand(program, {
    name: "ask",
    description: "Request clarification (reply + confused, keeps open)",
    messageHelp: "Question or clarification request",
    messageNoun: "question",
    actions: "reply + confused (item stays open)",
    done: (itemId) => `Asked for clarification on #${itemId}.`,
    status: "awaiting-reply",
  });
}
