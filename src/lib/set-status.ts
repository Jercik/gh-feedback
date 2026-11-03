import type { FeedbackBackend, FeedbackItemRef } from "./feedback-backend.js";
import type { ReactedStatus } from "./feedback-values.js";
import { statusReactions } from "./feedback-values.js";
import type { ReactionContent } from "./types.js";

function replacedReactions(
  viewerReactions: ReactionContent[],
  status: ReactedStatus,
): ReactionContent[] {
  const reaction = statusReactions[status];
  const reactions: ReactionContent[] = Object.values(statusReactions);
  return viewerReactions.filter((value) => value !== reaction && reactions.includes(value));
}

export async function setStatus(
  backend: FeedbackBackend,
  item: FeedbackItemRef,
  viewerReactions: ReactionContent[],
  status: ReactedStatus,
): Promise<void> {
  await backend.removeReactions(item, replacedReactions(viewerReactions, status));
  await backend.addReaction(item, statusReactions[status]);
}

// Undoes setStatus called with the same arguments, including one that failed partway.
export async function restoreStatus(
  backend: FeedbackBackend,
  item: FeedbackItemRef,
  viewerReactions: ReactionContent[],
  status: ReactedStatus,
): Promise<void> {
  const reaction = statusReactions[status];
  if (!viewerReactions.includes(reaction)) {
    await backend.removeReactions(item, [reaction]);
  }
  for (const prior of replacedReactions(viewerReactions, status)) {
    await backend.addReaction(item, prior);
  }
}
