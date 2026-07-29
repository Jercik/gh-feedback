import type { CapabilityResult, FeedbackItemRef, FeedbackOutcome } from "./feedback-backend.js";
import {
  forgejoNativeConversationResolver,
  getForgejoConversationResolutionReadiness,
} from "./forgejo-conversation-guard.js";
import { getForgejoViewer } from "./forgejo-environment.js";
import {
  changeForgejoConversationResolution,
  decideForgejoCompletion,
  isForgejoConversationResolvedBy,
} from "./forgejo-resolution.js";
import type { ForgejoReviewComment } from "./forgejo-schemas.js";

export async function completeForgejoItem(
  slug: string,
  item: FeedbackItemRef,
  outcome: FeedbackOutcome,
  reviewComments: readonly ForgejoReviewComment[] | undefined,
  reviewComment: ForgejoReviewComment | undefined,
): Promise<CapabilityResult> {
  const viewer = await getForgejoViewer();
  const resolver = forgejoNativeConversationResolver(reviewComments ?? [], reviewComment);
  const readiness =
    outcome === "disagreed"
      ? { ready: true as const }
      : await getForgejoConversationResolutionReadiness(slug, item, reviewComments);
  const decision = decideForgejoCompletion(
    item,
    outcome,
    isForgejoConversationResolvedBy(resolver, viewer),
    Boolean(resolver),
    readiness.ready ? undefined : readiness.reason,
  );
  if ("action" in decision) {
    return changeForgejoConversationResolution(slug, item, decision.action);
  }
  return decision;
}
