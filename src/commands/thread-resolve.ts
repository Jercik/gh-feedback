/**
 * Thread resolve/unresolve commands
 */

import type { Command } from "@commander-js/extra-typings";
import { getRepositoryInfo } from "../lib/github-environment.js";
import { exitWithMessage } from "../lib/git-helpers.js";
import {
  fetchReviewComment,
  findThreadByCommentId,
} from "../lib/fetch-item-detail.js";
import { resolveThread, unresolveThread } from "../lib/github-mutations.js";
import { formatThreadPreview } from "../lib/formatters.js";
import { SUCCESS, WARNING } from "../lib/tty-output.js";

export function registerResolveCommands(threadCmd: Command): void {
  // thread resolve
  threadCmd
    .command("resolve")
    .description("Resolve a thread by comment ID")
    .argument(
      "<comment-id>",
      "A comment ID from the thread to resolve",
      (value) => {
        const id = Number.parseInt(value);
        if (Number.isNaN(id) || id <= 0)
          exitWithMessage(`Error: Invalid comment ID "${value}".`);
        return id;
      },
    )
    .option("-n, --dry-run", "Preview without executing")
    .action((commentId: number, options: { dryRun?: boolean }) => {
      try {
        const { ownerRepo } = getRepositoryInfo();

        const comment = fetchReviewComment(ownerRepo, commentId);
        const { prNumber, thread } = findThreadByCommentId(comment, commentId);

        if (thread.isResolved) {
          console.log(`Thread is already resolved.`);
          return;
        }

        console.error(formatThreadPreview(prNumber, thread, "resolve"));

        if (options.dryRun) {
          console.log("Dry run: no changes made.");
          return;
        }

        console.error("Resolving thread...");
        const result = resolveThread(thread.id);

        if (result.isResolved) {
          console.log(`${SUCCESS()} Thread resolved.`);
        } else {
          console.log(`${WARNING()} Thread state unchanged.`);
        }
      } catch (error) {
        exitWithMessage(error instanceof Error ? error.message : String(error));
      }
    });

  // thread unresolve
  threadCmd
    .command("unresolve")
    .description("Unresolve a previously resolved thread")
    .argument(
      "<comment-id>",
      "A comment ID from the thread to unresolve",
      (value) => {
        const id = Number.parseInt(value);
        if (Number.isNaN(id) || id <= 0)
          exitWithMessage(`Error: Invalid comment ID "${value}".`);
        return id;
      },
    )
    .option("-n, --dry-run", "Preview without executing")
    .action((commentId: number, options: { dryRun?: boolean }) => {
      try {
        const { ownerRepo } = getRepositoryInfo();

        const comment = fetchReviewComment(ownerRepo, commentId);
        const { prNumber, thread } = findThreadByCommentId(comment, commentId);

        if (!thread.isResolved) {
          console.log(`Thread is already unresolved.`);
          return;
        }

        console.error(formatThreadPreview(prNumber, thread, "unresolve"));

        if (options.dryRun) {
          console.log("Dry run: no changes made.");
          return;
        }

        console.error("Unresolving thread...");
        const result = unresolveThread(thread.id);

        if (result.isResolved) {
          console.log(`${WARNING()} Thread state unchanged.`);
        } else {
          console.log(`${SUCCESS()} Thread unresolved.`);
        }
      } catch (error) {
        exitWithMessage(error instanceof Error ? error.message : String(error));
      }
    });
}
