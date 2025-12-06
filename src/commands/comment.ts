/**
 * Comment commands (IssueComment operations - Conversation tab)
 */

import type { Command } from "commander";
import { registerCommentReactionCommands } from "./comment-reactions.js";
import { registerCommentVisibilityCommands } from "./comment-visibility.js";

export function registerCommentCommands(program: Command): void {
  const commentCmd = program
    .command("comment")
    .alias("c")
    .description("Operations on PR comments (Conversation tab)");

  registerCommentReactionCommands(commentCmd);
  registerCommentVisibilityCommands(commentCmd);
}
