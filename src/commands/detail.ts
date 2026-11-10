/**
 * Detail command - fetch full content of a single item
 *
 * Used when summary truncates content and you need the full text.
 */

import type { Command } from "@commander-js/extra-typings";
import { exitWithMessage } from "../lib/git-helpers.js";
import { parseItemId } from "../lib/parse-item-id.js";
import { prOption, repoOption } from "../lib/feedback-target.js";
import { resolveBackend } from "../lib/resolve-backend.js";
import { formatItemDetail } from "../lib/format-item-detail.js";

export function registerDetailCommand(program: Command): void {
  program
    .command("detail")
    .description("Fetch full content of a feedback item")
    .argument("<id>", "The feedback item ID", parseItemId)
    .option("-j, --json", "Output as JSON")
    .addOption(repoOption())
    .addOption(prOption())
    .action(async (itemId, options) => {
      try {
        const { backend } = await resolveBackend(options);

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
