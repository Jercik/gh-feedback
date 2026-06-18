/**
 * Resolve / unresolve a Forgejo inline-review conversation.
 *
 * Forgejo's REST API has no resolve endpoint (confirmed against v15.0.3's
 * swagger), so resolving drives the same web handler the "Resolve conversation"
 * button hits: POST {owner}/{repo}/issues/resolve_conversation (the route accepts
 * issues|pulls; the UI uses issues even for a PR). The form's comment_id is the
 * line conversation's ROOT comment — the first comment carries resolve_doer_id
 * (Forgejo's diff/conversation template keys the button off `(index .comments 0)`)
 * and the API surfaces it back as that comment's `resolver`. The backend
 * canonicalizes a thread to that same root id, so resolve, status, and summary all
 * read the one comment. Forgejo's MarkConversation is idempotent (it no-ops when
 * the flag already matches), so re-resolving is safe.
 */

import type { CapabilityResult, FeedbackItemRef } from "./feedback-backend.js";
import type { ForgejoReviewComment } from "./forgejo-schemas.js";
import { forgejoWebForm } from "./forgejo-cli.js";

type ResolveAction = "Resolve" | "UnResolve";

const COMMENT_NO_RESOLVE =
  "Forgejo can't resolve or hide a PR-level comment; status is tracked by reaction only.";

interface ResolveConversationRequest {
  route: string;
  form: Record<string, string>;
}

export function buildResolveConversationRequest(
  slug: string,
  rootCommentId: number,
  action: ResolveAction,
): ResolveConversationRequest {
  return {
    route: `${slug}/issues/resolve_conversation`,
    form: { comment_id: String(rootCommentId), action, origin: "diff" },
  };
}

function resolveConversation(
  slug: string,
  rootCommentId: number,
  action: ResolveAction,
): Promise<void> {
  const { route, form } = buildResolveConversationRequest(slug, rootCommentId, action);
  return forgejoWebForm(route, form);
}

/**
 * Resolve/unresolve an item as a backend capability. Only an inline review
 * thread has a conversation to resolve; a PR-level issue comment can't be
 * resolved or hidden on Forgejo, so it degrades to an unsupported result.
 */
export async function resolveThreadCapability(
  slug: string,
  item: FeedbackItemRef,
  action: ResolveAction,
): Promise<CapabilityResult> {
  if (item.type !== "thread") {
    return { supported: false, reason: COMMENT_NO_RESOLVE };
  }
  await resolveConversation(slug, item.id, action);
  return { supported: true, applied: true };
}

/** A conversation is resolved when its root comment carries a resolver. */
export function reviewCommentIsResolved(comment: ForgejoReviewComment | undefined): boolean {
  return Boolean(comment?.resolver);
}
