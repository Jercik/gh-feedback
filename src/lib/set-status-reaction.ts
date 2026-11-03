import type { FeedbackBackend, FeedbackItemRef } from "./feedback-backend.js";
import type { ReactionContent } from "./types.js";

const STATUS_REACTIONS = ["eyes", "+1", "-1", "rocket", "confused"] as const;

export type StatusReaction = (typeof STATUS_REACTIONS)[number];

export function otherStatusReactions(reaction: StatusReaction): ReactionContent[] {
  return STATUS_REACTIONS.filter((other) => other !== reaction);
}

export async function setStatusReaction(
  backend: FeedbackBackend,
  item: FeedbackItemRef,
  viewerReactions: ReactionContent[],
  reaction: StatusReaction,
): Promise<void> {
  await backend.removeReactions(item, viewerReactions, otherStatusReactions(reaction));
  await backend.addReaction(item, reaction);
}
