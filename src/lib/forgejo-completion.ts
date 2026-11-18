import type { CapabilityResult, FeedbackItemRef, FeedbackOutcome } from "./feedback-backend.js";
import {
  forgejoNativeConversationResolver,
  getForgejoConversationResolutionReadiness,
} from "./forgejo-conversation-guard.js";
import { getForgejoViewer } from "./fgj-auth.js";
import {
  decideForgejoReopen,
  decideForgejoCompletion,
  forgejoCompletionNeedsReadiness,
  isForgejoConversationResolvedBy,
} from "./forgejo-resolution.js";
import { changeForgejoConversationResolution } from "./change-forgejo-conversation-resolution.js";
import { fetchPullReviewComments } from "./forgejo-pull-review-comments.js";

async function fetchForgejoTransitionState(slug: string, item: FeedbackItemRef) {
  const reviewComments = await fetchPullReviewComments(slug, item.prNumber);
  return {
    reviewComments,
    reviewComment: reviewComments.find(({ id }) => id === item.id),
  };
}

export async function completeForgejoItem(
  slug: string,
  item: FeedbackItemRef,
  outcome: FeedbackOutcome,
): Promise<CapabilityResult> {
  if (item.type !== "thread") {
    return { supported: true, applied: true };
  }
  const viewer = getForgejoViewer();
  const { reviewComments, reviewComment } = await fetchForgejoTransitionState(slug, item);
  const resolver = forgejoNativeConversationResolver(reviewComments, reviewComment);
  const readiness = forgejoCompletionNeedsReadiness(outcome, Boolean(resolver))
    ? await getForgejoConversationResolutionReadiness(slug, item, reviewComments)
    : { ready: true as const };
  const decision = decideForgejoCompletion(
    outcome,
    isForgejoConversationResolvedBy(resolver, viewer),
    Boolean(resolver),
    readiness.ready ? undefined : readiness.reason,
  );
  if ("action" in decision) {
    return changeForgejoConversationResolution(slug, item.prNumber, item.id, decision.action);
  }
  return decision;
}

export async function reopenForgejoItem(
  slug: string,
  item: FeedbackItemRef,
): Promise<CapabilityResult> {
  if (item.type !== "thread") {
    return { supported: true, applied: true };
  }
  const viewer = getForgejoViewer();
  const { reviewComments, reviewComment } = await fetchForgejoTransitionState(slug, item);
  const resolver = forgejoNativeConversationResolver(reviewComments, reviewComment);
  const decision = decideForgejoReopen(
    isForgejoConversationResolvedBy(resolver, viewer),
    Boolean(resolver),
  );
  if ("action" in decision) {
    return changeForgejoConversationResolution(slug, item.prNumber, item.id, decision.action);
  }
  return decision;
}
