/**
 * Detail command - fetch full content of a single item
 *
 * Used when summary truncates content and you need the full text.
 */

import type { Command } from "@commander-js/extra-typings";
import { getRepositoryInfo } from "../lib/github-environment.js";
import { exitWithMessage } from "../lib/git-helpers.js";
import { fetchItemDetail } from "../lib/fetch-item-detail.js";
import { formatItemDetail } from "../lib/format-item-detail.js";

export function registerDetailCommand(program: Command): void {
  program
    .command("detail")
    .description("Fetch full content of a feedback item")
    .argument("<id>", "The feedback item ID", (value) => {
      const id = Number.parseInt(value);
      if (Number.isNaN(id) || id <= 0) {
        exitWithMessage(`Error: Invalid ID "${value}".`);
      }
      return id;
    })
    .option("-j, --json", "Output as JSON")
    .action((itemId: number, options: { json?: boolean }) => {
      try {
        const { owner, repo } = getRepositoryInfo();

        const item = fetchItemDetail(owner, repo, itemId);

        if (options.json) {
          console.log(JSON.stringify(item, undefined, 2));
        } else {
          console.log(formatItemDetail(item));
        }
      } catch (error) {
        exitWithMessage(error instanceof Error ? error.message : String(error));
      }
    });
}
