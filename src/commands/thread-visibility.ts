/**
 * Thread visibility commands (hide/show)
 */

import type { Command } from "commander";
import { normalizeClassifier } from "../lib/normalize-input.js";
import { getRepositoryInfo } from "../lib/github-environment.js";
import { exitWithMessage } from "../lib/git-helpers.js";
import { fetchReviewComment } from "../lib/fetch-item-detail.js";
import { minimizeComment, unminimizeComment } from "../lib/github-mutations.js";

export function registerVisibilityCommands(threadCmd: Command): void {
  // thread hide
  threadCmd
    .command("hide")
    .description("Minimize/hide a thread comment")
    .argument(
      "<comment-id>",
      "The comment ID (databaseId) to minimize",
      (value) => {
        const id = Number.parseInt(value);
        if (Number.isNaN(id) || id <= 0) {
          exitWithMessage(`Error: Invalid comment ID "${value}".`);
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
      (commentId: number, options: { reason?: string; dryRun?: boolean }) => {
        try {
          const reason = normalizeClassifier(options.reason);
          const { ownerRepo } = getRepositoryInfo();

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
          console.error(`Action: minimize with reason ${reason}`);

          if (options.dryRun) {
            console.log("Dry run: no changes made.");
            return;
          }

          console.error("Minimizing comment...");
          const minimizeResult = minimizeComment(comment.node_id, reason);
          if (minimizeResult.isMinimized) {
            console.log(
              `\u2705 Thread comment #${commentId} minimized (${minimizeResult.minimizedReason ?? reason}).`,
            );
          } else {
            console.log(
              `\u26A0\uFE0F  Thread comment #${commentId} was not minimized.`,
            );
          }
        } catch (error) {
          exitWithMessage(
            error instanceof Error ? error.message : String(error),
          );
        }
      },
    );

  // thread show
  threadCmd
    .command("show")
    .description("Unminimize/show a hidden thread comment")
    .argument(
      "<comment-id>",
      "The comment ID (databaseId) to unminimize",
      (value) => {
        const id = Number.parseInt(value);
        if (Number.isNaN(id) || id <= 0) {
          exitWithMessage(`Error: Invalid comment ID "${value}".`);
        }
        return id;
      },
    )
    .option("-n, --dry-run", "Preview without executing")
    .action((commentId: number, options: { dryRun?: boolean }) => {
      try {
        const { ownerRepo } = getRepositoryInfo();

        const comment = fetchReviewComment(ownerRepo, commentId);

        console.error(`Thread comment #${commentId} by @${comment.user.login}`);
        if (comment.path) {
          console.error(
            `Location: ${comment.path}${comment.line ? `:${comment.line}` : ""}`,
          );
        }
        console.error("");
        console.error("Action: unminimize (show)");

        if (options.dryRun) {
          console.log("Dry run: no changes made.");
          return;
        }

        console.error("Unminimizing comment...");
        const unminimizeResult = unminimizeComment(comment.node_id);
        if (unminimizeResult.isMinimized) {
          console.log(
            `\u26A0\uFE0F  Thread comment #${commentId} state unchanged.`,
          );
        } else {
          console.log(`\u2705 Thread comment #${commentId} is now visible.`);
        }
      } catch (error) {
        exitWithMessage(error instanceof Error ? error.message : String(error));
      }
    });
}
