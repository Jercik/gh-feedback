import type { CapabilityResult, FeedbackItemRef, FeedbackOutcome } from "./feedback-backend.js";
import {
  forgejoNativeConversationResolver,
  getForgejoConversationResolutionReadiness,
} from "./forgejo-conversation-guard.js";
import { getForgejoViewer } from "./forgejo-environment.js";
import {
  changeForgejoConversationResolution,
  decideForgejoReopen,
  decideForgejoCompletion,
  forgejoCompletionNeedsReadiness,
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
  const readiness = forgejoCompletionNeedsReadiness(item, outcome, Boolean(resolver))
    ? await getForgejoConversationResolutionReadiness(slug, item, reviewComments)
    : { ready: true as const };
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

export async function reopenForgejoItem(
  slug: string,
  item: FeedbackItemRef,
  reviewComments: readonly ForgejoReviewComment[] | undefined,
  reviewComment: ForgejoReviewComment | undefined,
): Promise<CapabilityResult> {
  const viewer = await getForgejoViewer();
  const resolver = forgejoNativeConversationResolver(reviewComments ?? [], reviewComment);
  const decision = decideForgejoReopen(
    item,
    isForgejoConversationResolvedBy(resolver, viewer),
    Boolean(resolver),
  );
  if ("action" in decision) {
    return changeForgejoConversationResolution(slug, item, decision.action);
  }
  return decision;
}
