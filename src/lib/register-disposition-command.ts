import type { Command } from "@commander-js/extra-typings";
import type { FeedbackBackend, FeedbackItemRef, ItemStatus } from "./feedback-backend.js";
import type { DoneStatus } from "./feedback-types.js";
import { errorMessage } from "./error-message.js";
import { forgejoApiHost } from "./forgejo-cli.js";
import { prOption, repoOption } from "./feedback-target.js";
import { exitWithMessage } from "./git-helpers.js";
import { parseMessageSource, readMessage } from "./message-input.js";
import { parseItemId } from "./parse-item-id.js";
import { previewReply } from "./preview-reply.js";
import { resolveBackend } from "./resolve-backend.js";
import { createReviewServiceDispositionClient } from "./review-service-disposition-client.js";
import { loadReviewServiceCredentials } from "./review-service-credentials.js";
import {
  assertCurrentDisposition,
  assertStoredDisposition,
  buildDispositionKey,
  DispositionConflictError,
  isDispositionRecorded,
  parseDispositionRationale,
} from "./service-disposition.js";
import type { DispositionKind } from "./service-disposition.js";
import { selectReusableReply } from "./select-reusable-reply.js";
import { SUCCESS } from "./tty-output.js";
import { verboseLog } from "./verbose-mode.js";

interface DispositionVerb {
  name: "dismiss" | "reopen";
  description: string;
  actions: string;
  kind: DispositionKind;
  notFindingMessage: (itemId: number) => string;
  // Throws when the item's status refuses this verb; "only-if-recorded" admits a rerun that only finishes.
  admit: (
    itemId: number,
    doneStatus: DoneStatus | undefined,
  ) => { mode: "fresh" } | { mode: "only-if-recorded"; refusal: string };
  finish: (backend: FeedbackBackend, item: FeedbackItemRef, status: ItemStatus) => Promise<void>;
  done: (itemId: number) => string;
}

interface DispositionOptions {
  message?: string | undefined;
  bodyFile?: string | undefined;
  interactive?: boolean | undefined;
  dryRun?: boolean | undefined;
  repo?: string | undefined;
  pr?: string | undefined;
}

// Every check precedes the first write except those confirming the recorded disposition; a rerun with the same message completes whatever is missing.
async function runDisposition(
  verb: DispositionVerb,
  itemId: number,
  options: DispositionOptions,
): Promise<void> {
  const messageSource = parseMessageSource(options, "reply");
  const { backend, target } = await resolveBackend(options);
  const message = parseDispositionRationale(await readMessage(messageSource, "reply"));

  verboseLog(`Detecting item type for #${itemId}...`);
  const item = await backend.detectItem(itemId);
  const finding = await backend.readServiceFinding(item);
  if (finding === undefined) {
    throw new Error(verb.notFindingMessage(item.id));
  }
  const status = await backend.getItemStatus(item);
  const admission = verb.admit(item.id, status.doneStatus);

  const host = forgejoApiHost();
  const { serviceUrl, token } = loadReviewServiceCredentials(host, target.slug);
  const client = createReviewServiceDispositionClient({ serviceUrl, token });
  const repository = await client.reviewRepository(finding.reviewId);
  if (repository.forgeHost !== host || repository.slug !== target.slug) {
    throw new Error(
      `Error: The finding's review belongs to ${repository.slug} on ${repository.forgeHost}, not ${target.slug} on ${host}.`,
    );
  }
  const claim = await client.claim(finding.reviewId, finding.claimId);
  if (claim === undefined || claim.path !== finding.path) {
    throw new Error("Error: The finding's claim and path do not belong to its review.");
  }

  const recorded = isDispositionRecorded(claim.currentDisposition, verb.kind, message);
  if (admission.mode === "only-if-recorded" && !recorded) {
    throw new Error(admission.refusal);
  }

  previewReply(item, { messageNoun: "reply", actions: verb.actions }, message);
  if (options.dryRun) {
    console.error("Dry run: no changes made.");
    return;
  }

  let replyUrl: string | undefined;
  let landed = recorded
    ? `The ${verb.kind} disposition is already recorded with the review service`
    : undefined;
  try {
    if (!recorded) {
      const reusable = selectReusableReply(
        await backend.listOwnReplies(item),
        message,
        claim.currentDisposition?.createdAt,
      );
      verboseLog(reusable ? "Reusing the earlier reply..." : "Posting reply...");
      const reply = reusable ?? (await backend.reply(item, message));
      replyUrl = reply.url;
      landed = `Reply posted (${reply.url})`;

      verboseLog(`Recording ${verb.kind} with the review service...`);
      const stored = await client.recordDisposition(finding.claimId, {
        key: buildDispositionKey(host, target.slug, target.prNumber, reply.id),
        kind: verb.kind,
        rationale: message,
      });
      landed = `Reply posted (${reply.url}) and ${verb.kind} recorded with the review service`;
      assertStoredDisposition(stored, {
        claimId: finding.claimId,
        kind: verb.kind,
        rationale: message,
      });
      const current = await client.claim(finding.reviewId, finding.claimId);
      assertCurrentDisposition(current?.currentDisposition?.id, stored.id);
    }
    verboseLog("Finishing the item...");
    await verb.finish(backend, item, status);
  } catch (error) {
    if (landed === undefined) {
      throw error;
    }
    console.error(`Warning: ${landed}, but a later step failed: ${errorMessage(error)}`);
    if (!(error instanceof DispositionConflictError)) {
      console.error(
        `Rerun '${verb.name} ${itemId}' with the same message: it is safe and completes the missing steps.`,
      );
    }
    if (replyUrl !== undefined) {
      console.error(`Reply URL: ${replyUrl}`);
    }
    process.exitCode = 1;
    return;
  }

  verboseLog(`${SUCCESS} ${verb.done(itemId)}`);
  if (replyUrl !== undefined) {
    console.log(replyUrl);
  }
}

export function registerDispositionCommand(program: Command, verb: DispositionVerb): void {
  program
    .command(verb.name)
    .description(verb.description)
    .argument("<id>", "The feedback item ID", parseItemId)
    .option("-m, --message <text>", "Reply message explaining why; recorded as the rationale")
    .option("-f, --body-file <path>", "Read message from file (use - for stdin)")
    .option("-n, --dry-run", "Preview without executing")
    .option("-i, --interactive", "Type the message on stdin (Ctrl+D to finish)")
    .addOption(repoOption())
    .addOption(prOption())
    .action(async (itemId, options) => {
      try {
        await runDisposition(verb, itemId, options);
      } catch (error) {
        exitWithMessage(errorMessage(error));
      }
    });
}
