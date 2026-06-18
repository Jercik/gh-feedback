/**
 * Compute a Forgejo item's workflow status from its reactions and resolve flag.
 *
 * A review thread's done axis is its resolve flag (GitHub parity: a thread is
 * done when resolved, and the reaction only says which done status). A PR-level
 * issue comment can't be resolved on Forgejo, so its done axis stays reaction-
 * only. A review entity has no reaction or resolve endpoint, so it reports an
 * empty, never-done status.
 */

import type { ItemStatus, FeedbackItemRef } from "./feedback-backend.js";
import type { ForgejoItemMeta } from "./forgejo-item.js";
import {
  fetchReactions,
  normalizeForgejoReactions,
  deriveIsDone,
  viewerReactionStrings,
} from "./forgejo-reactions.js";
import { reviewCommentIsResolved } from "./forgejo-resolve-conversation.js";
import { getForgejoViewer } from "./forgejo-environment.js";
import { reactionToStatus, isStatusDone } from "./summary-types.js";

export async function computeForgejoItemStatus(
  slug: string,
  item: FeedbackItemRef,
  meta: ForgejoItemMeta,
): Promise<ItemStatus> {
  if (meta.kind === "review") {
    return { doneStatus: undefined, viewerReactions: [], isMinimized: false, isResolved: false };
  }

  const viewer = await getForgejoViewer();
  const reactions = await fetchReactions(slug, meta.kind, item.id);
  const normalized = normalizeForgejoReactions(reactions, viewer);

  const isResolved =
    meta.kind === "review-comment" ? reviewCommentIsResolved(meta.reviewComment) : false;
  const isDone = meta.kind === "review-comment" ? isResolved : deriveIsDone(reactions, viewer);
  const status = reactionToStatus(normalized, isDone);
  const viewerReactions = viewerReactionStrings(reactions, viewer);

  const doneStatus = isStatusDone(status)
    ? (status as "agreed" | "disagreed" | "acknowledged")
    : undefined;

  return { doneStatus, viewerReactions, isMinimized: false, isResolved };
}
