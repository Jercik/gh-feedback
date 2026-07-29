import type { ItemStatus } from "./feedback-backend.js";
import { getForgejoViewer } from "./forgejo-environment.js";
import type { ForgejoItemMeta } from "./forgejo-item.js";
import {
  deriveIsDone,
  fetchReactions,
  normalizeForgejoReactions,
  viewerReactionStrings,
} from "./forgejo-reactions.js";
import { isForgejoConversationResolvedBy } from "./forgejo-resolution.js";
import { forgejoNativeConversationAnchor } from "./forgejo-conversation-guard.js";
import { isStatusDone, reactionToStatus } from "./summary-types.js";

export async function getForgejoItemStatus(
  slug: string,
  meta: ForgejoItemMeta,
  itemId: number,
): Promise<ItemStatus> {
  if (meta.kind === "review") {
    return {
      doneStatus: undefined,
      viewerReactions: [],
      isMinimized: false,
      isResolved: false,
      viewerMayReopen: false,
    };
  }

  const viewer = await getForgejoViewer();
  const reactions = await fetchReactions(slug, meta.kind, itemId);
  const status = reactionToStatus(
    normalizeForgejoReactions(reactions, viewer),
    deriveIsDone(reactions, viewer),
  );
  const doneStatus = isStatusDone(status)
    ? (status as "agreed" | "disagreed" | "acknowledged")
    : undefined;

  const resolver = forgejoNativeConversationAnchor(
    meta.reviewComments ?? [],
    meta.reviewComment,
  )?.resolver;
  return {
    doneStatus,
    viewerReactions: viewerReactionStrings(reactions, viewer),
    isMinimized: false,
    isResolved: Boolean(resolver),
    viewerMayReopen: isForgejoConversationResolvedBy(resolver, viewer),
  };
}
