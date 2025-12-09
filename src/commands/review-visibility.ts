/**
 * Review visibility commands (hide/show)
 */

import type { Command } from "@commander-js/extra-typings";
import { normalizeClassifier } from "../lib/normalize-input.js";
import { getRepositoryInfo } from "../lib/github-environment.js";
import { exitWithMessage } from "../lib/git-helpers.js";
import { fetchReviewInfo } from "../lib/fetch-item-detail.js";
import { minimizeComment, unminimizeComment } from "../lib/github-mutations.js";
import { SUCCESS, WARNING } from "../lib/tty-output.js";

export function registerReviewVisibilityCommands(reviewCmd: Command): void {
  // review hide
  reviewCmd
    .command("hide")
    .description("Minimize/hide a review")
    .argument(
      "<review-id>",
      "The review ID (databaseId) to minimize",
      (value) => {
        const id = Number.parseInt(value);
        if (Number.isNaN(id) || id <= 0) {
          exitWithMessage(`Error: Invalid review ID "${value}".`);
        }
        return id;
      },
    )
    .option(
      "-r, --reason <classifier>",
      "Reason/classifier: RESOLVED, OUTDATED, OFF_TOPIC, SPAM, ABUSE, DUPLICATE (default: RESOLVED)",
    )
    .option("-n, --dry-run", "Preview without executing")
    .action(
      (reviewId: number, options: { reason?: string; dryRun?: boolean }) => {
        try {
          const reason = normalizeClassifier(options.reason);
          const { ownerRepo } = getRepositoryInfo();
          const review = fetchReviewInfo(ownerRepo, reviewId);

          if (review.isMinimized) {
            console.log(`Review #${reviewId} is already minimized.`);
            return;
          }

          console.error(`Review #${review.id} by @${review.author}`);
          console.error(`State: ${review.state}`);
          console.error(`PR #${review.prNumber}`);
          if (review.body) {
            const preview =
              review.body.length > 100
                ? review.body.slice(0, 100) + "..."
                : review.body;
            console.error(`Body: ${preview}`);
          }
          console.error("");
          console.error(`Action: minimize with reason ${reason}`);

          if (options.dryRun) {
            console.log("Dry run: no changes made.");
            return;
          }

          console.error("Minimizing review...");
          const minimizeResult = minimizeComment(review.nodeId, reason);
          if (minimizeResult.isMinimized) {
            console.log(
              `${SUCCESS()} Review #${reviewId} minimized (${minimizeResult.minimizedReason ?? reason}).`,
            );
          } else {
            console.log(`${WARNING()} Review #${reviewId} was not minimized.`);
          }
        } catch (error) {
          exitWithMessage(
            error instanceof Error ? error.message : String(error),
          );
        }
      },
    );

  // review show
  reviewCmd
    .command("show")
    .description("Unminimize/show a hidden review")
    .argument(
      "<review-id>",
      "The review ID (databaseId) to unminimize",
      (value) => {
        const id = Number.parseInt(value);
        if (Number.isNaN(id) || id <= 0) {
          exitWithMessage(`Error: Invalid review ID "${value}".`);
        }
        return id;
      },
    )
    .option("-n, --dry-run", "Preview without executing")
    .action((reviewId: number, options: { dryRun?: boolean }) => {
      try {
        const { ownerRepo } = getRepositoryInfo();
        const review = fetchReviewInfo(ownerRepo, reviewId);

        if (!review.isMinimized) {
          console.log(`Review #${reviewId} is not minimized.`);
          return;
        }

        console.error(`Review #${review.id} by @${review.author}`);
        console.error(`State: ${review.state}`);
        console.error(`PR #${review.prNumber}`);
        console.error("");
        console.error("Action: unminimize (show)");

        if (options.dryRun) {
          console.log("Dry run: no changes made.");
          return;
        }

        console.error("Unminimizing review...");
        const unminimizeResult = unminimizeComment(review.nodeId);
        if (unminimizeResult.isMinimized) {
          console.log(`${WARNING()} Review #${reviewId} state unchanged.`);
        } else {
          console.log(`${SUCCESS()} Review #${reviewId} is now visible.`);
        }
      } catch (error) {
        exitWithMessage(error instanceof Error ? error.message : String(error));
      }
    });
}
