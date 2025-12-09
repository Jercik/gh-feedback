/**
 * Review reaction commands
 */

import type { Command } from "@commander-js/extra-typings";
import { ALLOWED_REACTIONS } from "../lib/constants.js";
import { normalizeReactionInput } from "../lib/normalize-input.js";
import { getRepositoryInfo } from "../lib/github-environment.js";
import { exitWithMessage } from "../lib/git-helpers.js";
import { fetchReviewInfo } from "../lib/fetch-item-detail.js";
import { addReaction, removeReaction } from "../lib/github-mutations.js";
import { SUCCESS } from "../lib/tty-output.js";

export function registerReviewReactionCommands(reviewCmd: Command): void {
  // review react
  reviewCmd
    .command("react")
    .description("Add a reaction to a review")
    .argument(
      "<review-id>",
      "The review ID (databaseId) to react to",
      (value) => {
        const id = Number.parseInt(value);
        if (Number.isNaN(id) || id <= 0) {
          exitWithMessage(`Error: Invalid review ID "${value}".`);
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
        reviewId: number,
        reactionInput: string,
        options: { dryRun?: boolean },
      ) => {
        try {
          const { ownerRepo } = getRepositoryInfo();
          const reaction = normalizeReactionInput(reactionInput);
          const review = fetchReviewInfo(ownerRepo, reviewId);

          console.error(`Review #${review.id} by @${review.author}`);
          console.error(`State: ${review.state}`);
          console.error(`PR #${review.prNumber}`);
          console.error("");
          console.error(`Reaction to add: ${reaction}`);

          if (options.dryRun) {
            console.log("Dry run: no changes made.");
            return;
          }

          console.error("Posting reaction...");
          addReaction(review.nodeId, reaction);

          console.log(
            `${SUCCESS()} Reaction "${reaction}" added to review #${reviewId}.`,
          );
        } catch (error) {
          exitWithMessage(
            error instanceof Error ? error.message : String(error),
          );
        }
      },
    );

  // review unreact
  reviewCmd
    .command("unreact")
    .description("Remove a reaction from a review")
    .argument(
      "<review-id>",
      "The review ID (databaseId) to remove reaction from",
      (value) => {
        const id = Number.parseInt(value);
        if (Number.isNaN(id) || id <= 0) {
          exitWithMessage(`Error: Invalid review ID "${value}".`);
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
        reviewId: number,
        reactionInput: string,
        options: { dryRun?: boolean },
      ) => {
        try {
          const { ownerRepo } = getRepositoryInfo();
          const reaction = normalizeReactionInput(reactionInput);
          const review = fetchReviewInfo(ownerRepo, reviewId);

          console.error(`Review #${review.id} by @${review.author}`);
          console.error(`State: ${review.state}`);
          console.error(`PR #${review.prNumber}`);
          console.error("");
          console.error(`Reaction to remove: ${reaction}`);

          if (options.dryRun) {
            console.log("Dry run: no changes made.");
            return;
          }

          console.error("Removing reaction...");
          removeReaction(review.nodeId, reaction);

          console.log(
            `${SUCCESS()} Reaction "${reaction}" removed from review #${reviewId}.`,
          );
        } catch (error) {
          exitWithMessage(
            error instanceof Error ? error.message : String(error),
          );
        }
      },
    );
}
