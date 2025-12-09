/**
 * Thread reaction commands
 */

import type { Command } from "@commander-js/extra-typings";
import { ALLOWED_REACTIONS } from "../lib/constants.js";
import { normalizeReactionInput } from "../lib/normalize-input.js";
import { getRepositoryInfo } from "../lib/github-environment.js";
import { exitWithMessage } from "../lib/git-helpers.js";
import { fetchReviewComment } from "../lib/fetch-item-detail.js";
import { addReaction, removeReaction } from "../lib/github-mutations.js";
import { SUCCESS } from "../lib/tty-output.js";

export function registerReactionCommands(threadCmd: Command): void {
  // thread react
  threadCmd
    .command("react")
    .description("Add a reaction to a thread comment")
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

          const comment = fetchReviewComment(ownerRepo, commentId);

          console.error(
            `Thread comment #${commentId} by @${comment.user.login}`,
          );
          if (comment.path) {
            console.error(
              `Location: ${comment.path}${comment.line ? `:${comment.line}` : ""}`,
            );
          }
          console.error("");
          console.error(`Reaction to add: ${reaction}`);

          if (options.dryRun) {
            console.error("Dry run: no changes made.");
            return;
          }

          console.error("Posting reaction...");
          addReaction(comment.node_id, reaction);

          console.error(
            `${SUCCESS} Reaction "${reaction}" added to thread #${commentId}.`,
          );
        } catch (error) {
          exitWithMessage(
            error instanceof Error ? error.message : String(error),
          );
        }
      },
    );

  // thread unreact
  threadCmd
    .command("unreact")
    .description("Remove a reaction from a thread comment")
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

          const comment = fetchReviewComment(ownerRepo, commentId);

          console.error(
            `Thread comment #${commentId} by @${comment.user.login}`,
          );
          if (comment.path) {
            console.error(
              `Location: ${comment.path}${comment.line ? `:${comment.line}` : ""}`,
            );
          }
          console.error("");
          console.error(`Reaction to remove: ${reaction}`);

          if (options.dryRun) {
            console.error("Dry run: no changes made.");
            return;
          }

          console.error("Removing reaction...");
          removeReaction(comment.node_id, reaction);

          console.error(
            `${SUCCESS} Reaction "${reaction}" removed from thread #${commentId}.`,
          );
        } catch (error) {
          exitWithMessage(
            error instanceof Error ? error.message : String(error),
          );
        }
      },
    );
}
