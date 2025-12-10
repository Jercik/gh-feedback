/**
 * Ack command - acknowledge informational item
 *
 * Performs: 🚀 (rocket) + hide
 * Used for bot summaries, status updates, or noise.
 */

import type { Command } from "@commander-js/extra-typings";
import { getRepositoryInfo } from "../lib/github-environment.js";
import { exitWithMessage } from "../lib/git-helpers.js";
import { detectItemType } from "../lib/detect-item-type.js";
import { addReactionToItem } from "../lib/react-item.js";
import { resolveItem } from "../lib/resolve-item.js";
import { SUCCESS } from "../lib/tty-output.js";

export function registerAckCommand(program: Command): void {
  program
    .command("ack")
    .description("Acknowledge informational item (rocket + hide)")
    .argument("<id>", "The feedback item ID", (value) => {
      const id = Number.parseInt(value);
      if (Number.isNaN(id) || id <= 0) {
        exitWithMessage(`Error: Invalid ID "${value}".`);
      }
      return id;
    })
    .option("-n, --dry-run", "Preview without executing")
    .action((itemId: number, options: { dryRun?: boolean }) => {
      try {
        const { owner, repo } = getRepositoryInfo();

        console.error(`Detecting item type for #${itemId}...`);
        const item = detectItemType(owner, repo, itemId);

        console.error(`Found ${item.type} #${item.id} by @${item.author}`);
        if (item.path) {
          console.error(
            `Location: ${item.path}${item.line ? `:${item.line}` : ""}`,
          );
        }
        console.error("");
        console.error("Actions: rocket + hide (acknowledge noise)");

        if (options.dryRun) {
          console.error("Dry run: no changes made.");
          return;
        }

        // 1. Add rocket
        console.error("Adding reaction...");
        addReactionToItem(item, "rocket");

        // 2. Hide/resolve
        console.error("Hiding...");
        resolveItem(item);

        console.error(`${SUCCESS} Acknowledged #${itemId}.`);
      } catch (error) {
        exitWithMessage(error instanceof Error ? error.message : String(error));
      }
    });
}
