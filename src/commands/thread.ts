/**
 * Thread commands (PullRequestReviewComment operations - Files Changed tab)
 */

import type { Command } from "@commander-js/extra-typings";
import { registerReplyCommand } from "./thread-reply.js";
import { registerResolveCommands } from "./thread-resolve.js";
import { registerReactionCommands } from "./thread-reactions.js";
import { registerVisibilityCommands } from "./thread-visibility.js";

export function registerThreadCommands(program: Command): void {
  const threadCmd = program
    .command("thread")
    .alias("t")
    .description("Operations on PR review threads (Files Changed tab)");

  registerReplyCommand(threadCmd);
  registerResolveCommands(threadCmd);
  registerReactionCommands(threadCmd);
  registerVisibilityCommands(threadCmd);
}
