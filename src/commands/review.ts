import type { Command } from "@commander-js/extra-typings";
import { fetchReviewDocument } from "../lib/fetch-review-document.js";
import { prOption, repoOption, resolveFeedbackTarget } from "../lib/feedback-target.js";
import { exitWithMessage } from "../lib/git-helpers.js";

export function registerReviewCommand(program: Command): void {
  program
    .command("review")
    .description("Read the review service's facts for the PR's summary report; JSON")
    .addOption(repoOption())
    .addOption(prOption())
    .action(async (options) => {
      try {
        const { slug, prNumber } = await resolveFeedbackTarget(options);
        const document = await fetchReviewDocument(slug, prNumber);
        console.log(JSON.stringify(document, undefined, 2));
      } catch (error) {
        exitWithMessage(error instanceof Error ? error.message : String(error));
      }
    });
}
