import type { ItemStatus } from "./feedback-backend.js";
import { getForgejoViewer } from "./forgejo-environment.js";
import type { ForgejoItemMeta } from "./forgejo-item.js";
import { fetchReactions, viewerReactionStrings } from "./forgejo-reactions.js";
import { deriveStatus } from "./feedback-values.js";
import { isForgejoConversationResolvedBy } from "./forgejo-resolution.js";
import { forgejoNativeConversationAnchor } from "./forgejo-conversation-guard.js";
import { isStatusDone } from "./summary-types.js";

export async function getForgejoItemStatus(
  slug: string,
  meta: ForgejoItemMeta,
  itemId: number,
): Promise<ItemStatus> {
  const viewer = await getForgejoViewer();
  const reactions = await fetchReactions(slug, itemId);
  const viewerReactions = viewerReactionStrings(reactions, viewer);
  const { status } = deriveStatus(viewerReactions);
  const doneStatus = isStatusDone(status)
    ? (status as "agreed" | "disagreed" | "acknowledged")
    : undefined;

  const resolver = forgejoNativeConversationAnchor(
    meta.reviewComments ?? [],
    meta.reviewComment,
  )?.resolver;
  return {
    doneStatus,
    viewerReactions,
    isResolved: Boolean(resolver),
    viewerMayReopen: isForgejoConversationResolvedBy(resolver, viewer),
  };
}
