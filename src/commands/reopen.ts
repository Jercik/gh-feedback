/**
 * Reopen command - reconsider a dismissed review-service finding
 */

import type { Command } from "@commander-js/extra-typings";
import { registerDispositionCommand } from "../lib/register-disposition-command.js";
import { startItem } from "../lib/start-item.js";

const actions =
  "reply, records the reopening with the review service, then eyes; reopens its conversation if you resolved it";

const notDismissed = (itemId: number): string =>
  `Error: Item #${itemId} is not dismissed; 'reopen' reconsiders a dismissal. Use 'start' for other items.`;

export function registerReopenCommand(program: Command): void {
  registerDispositionCommand(program, {
    name: "reopen",
    description: `Reconsider a dismissed review-service finding (${actions})`,
    actions,
    kind: "reopened",
    notFindingMessage: notDismissed,
    admit: (itemId, doneStatus) => {
      if (doneStatus !== "dismissed") {
        throw new Error(notDismissed(itemId));
      }
      return "fresh";
    },
    finish: (backend, item, status) =>
      startItem(backend, item, status.viewerReactions, status.viewerMayReopen),
    done: (itemId) => `Reopened #${itemId}.`,
  });
}
