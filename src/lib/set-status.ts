import type { FeedbackBackend, FeedbackItemRef } from "./feedback-backend.js";
import type { ReactedStatus } from "./feedback-values.js";
import { statusReactions } from "./feedback-values.js";
import type { ReactionContent } from "./types.js";

function replacedReactions(status: ReactedStatus): ReactionContent[] {
  const reaction = statusReactions[status];
  return Object.values(statusReactions).filter((other) => other !== reaction);
}

export async function setStatus(
  backend: FeedbackBackend,
  item: FeedbackItemRef,
  viewerReactions: ReactionContent[],
  status: ReactedStatus,
): Promise<void> {
  await backend.removeReactions(item, viewerReactions, replacedReactions(status));
  await backend.addReaction(item, statusReactions[status]);
}

// Forgejo answers a repeated add and a delete of an absent reaction with 200, so this also
// undoes a setStatus that failed partway.
export async function restoreStatus(
  backend: FeedbackBackend,
  item: FeedbackItemRef,
  viewerReactions: ReactionContent[],
  status: ReactedStatus,
): Promise<void> {
  const reaction = statusReactions[status];
  if (!viewerReactions.includes(reaction)) {
    await backend.removeReactions(item, [reaction], [reaction]);
  }
  const replaced = replacedReactions(status);
  for (const prior of viewerReactions.filter((value) => replaced.includes(value))) {
    await backend.addReaction(item, prior);
  }
}
