import type { CapabilityResult, FeedbackItemRef, FeedbackOutcome } from "./feedback-backend.js";
import {
  forgejoConversationReadyToResolve,
  forgejoNativeConversationResolver,
} from "./forgejo-conversation-guard.js";
import { getForgejoViewer } from "./forgejo-environment.js";
import { completeForgejoOutcome, isForgejoConversationResolvedBy } from "./forgejo-resolution.js";
import type { ForgejoReviewComment } from "./forgejo-schemas.js";

export async function completeForgejoItem(
  slug: string,
  item: FeedbackItemRef,
  outcome: FeedbackOutcome,
  reviewComments: readonly ForgejoReviewComment[],
  reviewComment: ForgejoReviewComment | undefined,
): Promise<CapabilityResult> {
  const viewer = await getForgejoViewer();
  const resolver = forgejoNativeConversationResolver(reviewComments, reviewComment);
  const readyToResolve =
    outcome !== "disagreed" &&
    (await forgejoConversationReadyToResolve(slug, item, reviewComments));
  return completeForgejoOutcome(
    slug,
    item,
    outcome,
    isForgejoConversationResolvedBy(resolver, viewer),
    Boolean(resolver),
    readyToResolve,
  );
}
