import type { Command } from "@commander-js/extra-typings";
import { fetchFeedbackSnapshot } from "../lib/feedback-snapshot.js";
import { detectProvider } from "../lib/provider.js";
import { git, exitWithMessage } from "../lib/git-helpers.js";

export function registerSnapshotCommand(program: Command): void {
  program
    .command("snapshot")
    .description("Read complete PR feedback twice; JSON, exit 0 stable or 3 unstable")
    .requiredOption("--pr <number>", "Pull request number")
    .option("--repo <owner/repo>", "Repository slug (defaults to origin)")
    .action(async (options: { pr: string; repo?: string }) => {
      try {
        if (!/^[1-9]\d*$/u.test(options.pr) || !Number.isSafeInteger(Number(options.pr))) {
          throw new Error("--pr must be a positive safe integer");
        }
        const slug = options.repo ?? detectProvider(git("remote", "get-url", "origin"))?.slug;
        if (!slug || !/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/u.test(slug)) {
          throw new Error("--repo must be owner/repo");
        }
        const snapshot = await fetchFeedbackSnapshot(slug, Number(options.pr));
        console.log(JSON.stringify(snapshot, undefined, 2));
        process.exitCode = snapshot.stable ? 0 : 3;
      } catch (error) {
        exitWithMessage(error instanceof Error ? error.message : String(error));
      }
    });
}
