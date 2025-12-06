/**
 * Comment visibility commands (hide/show)
 */

import type { Command } from "commander";
import { normalizeClassifier } from "../lib/normalize-input.js";
import { getRepositoryInfo } from "../lib/github-environment.js";
import { exitWithMessage } from "../lib/git-helpers.js";
import { fetchIssueComment } from "../lib/fetch-item-detail.js";
import { minimizeComment, unminimizeComment } from "../lib/github-mutations.js";
import { formatHidePreview } from "../lib/formatters.js";

export function registerCommentVisibilityCommands(commentCmd: Command): void {
  // comment hide
  commentCmd
    .command("hide")
    .description("Minimize/hide a comment with a reason")
    .argument(
      "<comment-id>",
      "The comment ID (databaseId) to minimize",
      (value) => {
        const id = Number.parseInt(value);
        if (Number.isNaN(id) || id <= 0)
          exitWithMessage(`Error: Invalid comment ID "${value}".`);
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
          const { comment, issue } = fetchIssueComment(ownerRepo, commentId);

          console.error(formatHidePreview(issue, comment, reason));

          if (options.dryRun) {
            console.log("Dry run: no changes made.");
            return;
          }

          console.error("Minimizing comment...");
          const minimizeResult = minimizeComment(comment.node_id, reason);
          if (minimizeResult.isMinimized) {
            console.log(
              `\u2705 Comment #${comment.id} minimized (${minimizeResult.minimizedReason ?? reason}).`,
            );
          } else {
            console.log(
              `\u26A0\uFE0F  Comment #${comment.id} was not minimized.`,
            );
          }
        } catch (error) {
          exitWithMessage(
            error instanceof Error ? error.message : String(error),
          );
        }
      },
    );

  // comment show
  commentCmd
    .command("show")
    .description("Unminimize/show a hidden comment")
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
        const { comment, issue } = fetchIssueComment(ownerRepo, commentId);

        console.error(`Comment #${comment.id} on PR #${issue.number}`);
        console.error(`Author: @${comment.user.login}`);
        console.error("");
        console.error("Action: unminimize (show)");

        if (options.dryRun) {
          console.log("Dry run: no changes made.");
          return;
        }

        console.error("Unminimizing comment...");
        const unminimizeResult = unminimizeComment(comment.node_id);
        if (unminimizeResult.isMinimized) {
          console.log(`\u26A0\uFE0F  Comment #${commentId} state unchanged.`);
        } else {
          console.log(`\u2705 Comment #${commentId} is now visible.`);
        }
      } catch (error) {
        exitWithMessage(error instanceof Error ? error.message : String(error));
      }
    });
}
