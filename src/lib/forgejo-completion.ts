import type { CapabilityResult, FeedbackItemRef, FeedbackOutcome } from "./feedback-backend.js";
import {
  forgejoNativeConversationResolver,
  getForgejoConversationResolutionReadiness,
} from "./forgejo-conversation-guard.js";
import { getForgejoViewer } from "./forgejo-environment.js";
import {
  decideForgejoReopen,
  decideForgejoCompletion,
  forgejoCompletionNeedsReadiness,
  forgejoUnsupportedHideResult,
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
    return forgejoUnsupportedHideResult();
  }
  const [{ reviewComments, reviewComment }, viewer] = await Promise.all([
    fetchForgejoTransitionState(slug, item),
    getForgejoViewer(),
  ]);
  const resolver = forgejoNativeConversationResolver(reviewComments, reviewComment);
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
    return changeForgejoConversationResolution(slug, item.prNumber, item.id, decision.action);
  }
  return decision;
}

export async function reopenForgejoItem(
  slug: string,
  item: FeedbackItemRef,
): Promise<CapabilityResult> {
  if (item.type !== "thread") {
    return forgejoUnsupportedHideResult();
  }
  const [{ reviewComments, reviewComment }, viewer] = await Promise.all([
    fetchForgejoTransitionState(slug, item),
    getForgejoViewer(),
  ]);
  const resolver = forgejoNativeConversationResolver(reviewComments, reviewComment);
  const decision = decideForgejoReopen(
    item,
    isForgejoConversationResolvedBy(resolver, viewer),
    Boolean(resolver),
  );
  if ("action" in decision) {
    return changeForgejoConversationResolution(slug, item.prNumber, item.id, decision.action);
  }
  return decision;
}
