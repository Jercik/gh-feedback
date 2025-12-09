/**
 * Thread reply command
 */

import type { Command } from "@commander-js/extra-typings";
import {
  readMessageFromFile,
  readMessageFromStdin,
} from "../lib/message-input.js";
import { getRepositoryInfo } from "../lib/github-environment.js";
import { exitWithMessage } from "../lib/git-helpers.js";
import { getCommentInfo, postReply } from "../lib/fetch-item-detail.js";
import { formatCommentInfo } from "../lib/formatters.js";
import { SUCCESS } from "../lib/tty-output.js";

export function registerReplyCommand(threadCmd: Command): void {
  threadCmd
    .command("reply")
    .description(
      "Reply to an existing thread\n\n" +
        "IMPORTANT: Always wrap Markdown replies in SINGLE quotes to preserve backticks:\n" +
        "  gh-feedback thread reply 123 -m 'Fixed in `abc123`'",
    )
    .argument("<comment-id>", "The comment ID to reply to", (value) => {
      const id = Number.parseInt(value);
      if (Number.isNaN(id) || id <= 0) {
        exitWithMessage(`Error: Invalid comment ID: ${value}`);
      }
      return id;
    })
    .option("-m, --message <text>", "Reply message")
    .option("-f, --file <path>", "Read reply message from a file")
    .option("-n, --dry-run", "Preview without executing")
    .action(
      async (
        commentId: number,
        options: {
          message?: string;
          file?: string;
          dryRun?: boolean;
        },
      ) => {
        try {
          const { ownerRepo } = getRepositoryInfo();

          const commentInfo = getCommentInfo(ownerRepo, commentId);

          if (commentInfo.inReplyToId) {
            console.error(formatCommentInfo(commentInfo));
            exitWithMessage(
              "\nError: Cannot reply to a comment that is already a reply.",
            );
          }

          let replyText: string;
          if (options.file) {
            replyText = await readMessageFromFile(options.file);
          } else if (options.message) {
            replyText = options.message;
          } else {
            replyText = await readMessageFromStdin("reply");
          }

          console.error(formatCommentInfo(commentInfo));
          console.error("\nYour reply:");
          console.error("---");
          console.error(replyText);
          console.error("---");

          if (options.dryRun) {
            console.log("Dry run: no changes made.");
            return;
          }

          console.error("\nPosting reply...");
          const result = postReply(
            ownerRepo,
            commentInfo.pullRequestNumber,
            commentId,
            replyText,
          );

          console.log(`${SUCCESS} Reply posted successfully!`);
          console.log(`   Comment ID: ${result.id}`);
          console.log(`   URL: ${result.url}`);
        } catch (error: unknown) {
          exitWithMessage(
            error instanceof Error ? error.message : String(error),
          );
        }
      },
    );
}
