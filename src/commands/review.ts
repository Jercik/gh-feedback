/**
 * Review commands (PullRequestReview operations)
 */

import type { Command } from "commander";
import { registerReviewReactionCommands } from "./review-reactions.js";
import { registerReviewVisibilityCommands } from "./review-visibility.js";

export function registerReviewCommands(program: Command): void {
  const reviewCmd = program
    .command("review")
    .alias("r")
    .description("Operations on PR reviews");

  registerReviewReactionCommands(reviewCmd);
  registerReviewVisibilityCommands(reviewCmd);
}
