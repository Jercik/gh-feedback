/**
 * Detail command - fetch full content of a single item
 *
 * Used when summary truncates content and you need the full text.
 */

import type { Command } from "@commander-js/extra-typings";
import { exitWithMessage } from "../lib/git-helpers.js";
import { resolveBackend } from "../lib/resolve-backend.js";
import { formatItemDetail } from "../lib/format-item-detail.js";

export function registerDetailCommand(program: Command): void {
  program
    .command("detail")
    .description("Fetch full content of a feedback item")
    .argument("<id>", "The feedback item ID", (value) => {
      const id = Math.trunc(Number(value));
      if (Number.isNaN(id) || id <= 0) {
        exitWithMessage(`Error: Invalid ID "${value}".`);
      }
      return id;
    })
    .option("-j, --json", "Output as JSON")
    .action(async (itemId: number, options: { json?: boolean }) => {
      try {
        const { backend } = resolveBackend();

        const item = await backend.fetchItemDetail(itemId);

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
