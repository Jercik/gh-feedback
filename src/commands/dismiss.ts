/**
 * Dismiss command - reject a review-service finding for good
 */

import type { Command } from "@commander-js/extra-typings";
import { doneItemMessage } from "../lib/done-item-message.js";
import { registerDispositionCommand } from "../lib/register-disposition-command.js";
import { reportCompletionResult } from "../lib/report-completion-result.js";
import { setStatus } from "../lib/set-status.js";

const actions =
  "reply + hooray, records the dismissal with the review service; resolves its inline conversation once every other item in it is settled";

export function registerDismissCommand(program: Command): void {
  registerDispositionCommand(program, {
    name: "dismiss",
    description: `Reject a review-service finding for good (${actions})`,
    actions,
    kind: "dismissed",
    notFindingMessage: (itemId) =>
      `Error: #${itemId} is not a review-service finding; use 'disagree'.`,
    admit: (itemId, doneStatus) => {
      if (doneStatus === undefined) {
        return "fresh";
      }
      if (doneStatus === "dismissed") {
        return "only-if-recorded";
      }
      throw new Error(doneItemMessage(itemId, doneStatus));
    },
    finish: async (backend, item, status) => {
      await setStatus(backend, item, status.viewerReactions, "dismissed");
      reportCompletionResult(await backend.complete(item, "dismissed"));
    },
    done: (itemId) => `Dismissed #${itemId}.`,
  });
}
