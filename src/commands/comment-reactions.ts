/**
 * Comment reaction commands
 */

import type { Command } from "@commander-js/extra-typings";
import { ALLOWED_REACTIONS } from "../lib/constants.js";
import { normalizeReactionInput } from "../lib/normalize-input.js";
import { getRepositoryInfo } from "../lib/github-environment.js";
import { exitWithMessage } from "../lib/git-helpers.js";
import { fetchIssueComment } from "../lib/fetch-item-detail.js";
import { addReaction, removeReaction } from "../lib/github-mutations.js";
import { summarizeReactions, formatReactPreview } from "../lib/formatters.js";
import { SUCCESS } from "../lib/tty-output.js";

export function registerCommentReactionCommands(commentCmd: Command): void {
  // comment react
  commentCmd
    .command("react")
    .description("Add a reaction to a comment")
    .argument(
      "<comment-id>",
      "The comment ID (databaseId) to react to",
      (value) => {
        const id = Number.parseInt(value);
        if (Number.isNaN(id) || id <= 0) {
          exitWithMessage(`Error: Invalid comment ID "${value}".`);
        }
        return id;
      },
    )
    .argument(
      "<reaction>",
      `Reaction to add (one of: ${ALLOWED_REACTIONS.join(", ")})`,
    )
    .option("-n, --dry-run", "Preview without executing")
    .action(
      (
        commentId: number,
        reactionInput: string,
        options: { dryRun?: boolean },
      ) => {
        try {
          const { ownerRepo } = getRepositoryInfo();
          const reaction = normalizeReactionInput(reactionInput);
          const { comment, issue } = fetchIssueComment(ownerRepo, commentId);
          const reactions = summarizeReactions(comment);

          console.error(formatReactPreview(issue, comment, reactions));
          console.error("");
          console.error(`Reaction to add: ${reaction}`);

          if (options.dryRun) {
            console.log("Dry run: no changes made.");
            return;
          }

          console.error("Posting reaction...");
          addReaction(comment.node_id, reaction);

          console.log(
            `${SUCCESS()} Reaction "${reaction}" added to comment #${commentId}.`,
          );
        } catch (error) {
          exitWithMessage(
            error instanceof Error ? error.message : String(error),
          );
        }
      },
    );

  // comment unreact
  commentCmd
    .command("unreact")
    .description("Remove a reaction from a comment")
    .argument(
      "<comment-id>",
      "The comment ID (databaseId) to remove reaction from",
      (value) => {
        const id = Number.parseInt(value);
        if (Number.isNaN(id) || id <= 0) {
          exitWithMessage(`Error: Invalid comment ID "${value}".`);
        }
        return id;
      },
    )
    .argument(
      "<reaction>",
      `Reaction to remove (one of: ${ALLOWED_REACTIONS.join(", ")})`,
    )
    .option("-n, --dry-run", "Preview without executing")
    .action(
      (
        commentId: number,
        reactionInput: string,
        options: { dryRun?: boolean },
      ) => {
        try {
          const { ownerRepo } = getRepositoryInfo();
          const reaction = normalizeReactionInput(reactionInput);
          const { comment, issue } = fetchIssueComment(ownerRepo, commentId);

          console.error(`Comment #${comment.id} on PR #${issue.number}`);
          console.error(`Author: @${comment.user.login}`);
          console.error("");
          console.error(`Reaction to remove: ${reaction}`);

          if (options.dryRun) {
            console.log("Dry run: no changes made.");
            return;
          }

          console.error("Removing reaction...");
          removeReaction(comment.node_id, reaction);

          console.log(
            `${SUCCESS()} Reaction "${reaction}" removed from comment #${commentId}.`,
          );
        } catch (error) {
          exitWithMessage(
            error instanceof Error ? error.message : String(error),
          );
        }
      },
    );
}
