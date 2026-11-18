import type { Command } from "@commander-js/extra-typings";
import { fetchFeedbackSnapshot } from "../lib/feedback-snapshot.js";
import { prOption, repoOption, resolveFeedbackTarget } from "../lib/feedback-target.js";
import { exitWithMessage } from "../lib/git-helpers.js";
import { VIEWER_OPTION_HELP, viewerOption } from "../lib/viewer-option.js";

export function registerSnapshotCommand(program: Command): void {
  program
    .command("snapshot")
    .description("Read complete PR feedback twice; JSON, exit 0 stable or 3 unstable")
    .addOption(repoOption())
    .addOption(prOption())
    .addOption(viewerOption())
    .addHelpText("after", VIEWER_OPTION_HELP)
    .action(async (options) => {
      try {
        const { slug, prNumber } = await resolveFeedbackTarget(options);
        const snapshot = await fetchFeedbackSnapshot(slug, prNumber, options.viewer);
        console.log(JSON.stringify(snapshot, undefined, 2));
        process.exitCode = snapshot.stable ? 0 : 3;
      } catch (error) {
        exitWithMessage(error instanceof Error ? error.message : String(error));
      }
    });
}
