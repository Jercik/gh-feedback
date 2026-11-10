/**
 * Forgejo backend: REST /api/v1 implementation of the FeedbackBackend seam.
 *
 * The j4k Forgejo fork resolves inline conversations through the local fgj CLI.
 * Plain issue comments and review bodies settle through reactions alone.
 *
 * `detectItem` returns the neutral ref but caches the resolved item kind by
 * `id`, so reply/react re-use it without re-probing the REST endpoints. For an
 * inline review comment it also canonicalizes the id to the conversation root,
 * so a reply id the user targets resolves to the finding and every reaction read
 * and write lands on the one comment that carries the thread's status.
 */

import type { ItemDetail } from "./fetch-item-detail.js";
import type { FeedbackSummary } from "./summary-types.js";
import type { ReactionContent } from "./types.js";
import type {
  CapabilityResult,
  FeedbackBackend,
  FeedbackItemRef,
  ItemStatus,
  ReplyResult,
  SummaryOptions,
} from "./feedback-backend.js";
import type { FeedbackTarget } from "./feedback-target.js";
import { forgejoFetch } from "./forgejo-cli.js";
import { reactionsPath } from "./forgejo-reactions.js";
import { resolveItemMeta, metaKindToItemType } from "./forgejo-item.js";
import type { ForgejoItemMeta } from "./forgejo-item.js";
import { conversationRootOf } from "./forgejo-conversation-root.js";
import { buildSummary } from "./forgejo-summary.js";
import { buildItemDetail } from "./forgejo-item-detail.js";
import { reviewCommentLine } from "./forgejo-review-comment-line.js";
import { postForgejoReply } from "./forgejo-reply.js";
import { getForgejoViewer } from "./forgejo-environment.js";
import { exitWithMessage } from "./git-helpers.js";
import { getForgejoItemStatus } from "./forgejo-item-status.js";
import { completeForgejoItem, reopenForgejoItem } from "./forgejo-completion.js";

export function createForgejoBackend(target: FeedbackTarget): FeedbackBackend {
  const { slug, prNumber } = target;
  /** Cache the detected meta so reply/react reuse it without re-probing. */
  const metaCache = new Map<number, ForgejoItemMeta>();

  async function detect(itemId: number): Promise<FeedbackItemRef> {
    const resolved = await resolveItemMeta(slug, prNumber, itemId);
    if (!resolved) {
      return exitWithMessage(`Error: Could not find item #${itemId} in Forgejo PR #${prNumber}.`);
    }
    // Canonicalize a review comment to its conversation root, so a reply id the
    // user may have targeted resolves to the finding — every later reaction read
    // and write then lands on the same comment summary reports.
    if (resolved.meta.kind === "review-comment" && resolved.reviewComment) {
      const viewer = await getForgejoViewer();
      const root =
        conversationRootOf(resolved.reviewComments ?? [], itemId, viewer) ?? resolved.reviewComment;
      metaCache.set(root.id, {
        kind: "review-comment",
        prNumber,
        reviewComment: root,
        reviewComments: resolved.reviewComments,
      });
      return {
        type: "thread",
        id: root.id,
        author: root.user?.login ?? "ghost",
        prNumber,
        path: root.path ?? null,
        line: reviewCommentLine(root),
      };
    }

    metaCache.set(itemId, resolved.meta);
    return {
      type: metaKindToItemType(resolved.meta.kind),
      id: itemId,
      author: resolved.issueComment?.user?.login ?? resolved.review?.user?.login ?? "ghost",
      prNumber,
      path: null,
      line: null,
    };
  }

  async function metaFor(item: FeedbackItemRef): Promise<ForgejoItemMeta> {
    const cached = metaCache.get(item.id);
    if (cached) {
      return cached;
    }
    const resolved = await resolveItemMeta(slug, item.prNumber, item.id);
    if (!resolved) {
      return exitWithMessage(`Error: Could not re-resolve Forgejo item #${item.id}.`);
    }
    metaCache.set(item.id, resolved.meta);
    return resolved.meta;
  }

  return {
    fetchSummary(options: SummaryOptions): Promise<FeedbackSummary> {
      return buildSummary(slug, prNumber, options);
    },

    async fetchItemDetail(itemId: number): Promise<ItemDetail> {
      return buildItemDetail(slug, prNumber, itemId);
    },

    async detectItem(itemId: number): Promise<FeedbackItemRef> {
      return detect(itemId);
    },

    async getItemStatus(item: FeedbackItemRef): Promise<ItemStatus> {
      const meta = await metaFor(item);
      return getForgejoItemStatus(slug, meta, item.id);
    },

    async reply(item: FeedbackItemRef, message: string): Promise<ReplyResult> {
      // A thread reply nests under its parent review comment, so it needs that
      // comment's review id + line; other item types have no thread to nest in.
      if (item.type === "thread") {
        const meta = await metaFor(item);
        return postForgejoReply(slug, item, message, meta.reviewComment);
      }
      return postForgejoReply(slug, item, message, undefined);
    },

    async addReaction(item: FeedbackItemRef, reaction: ReactionContent): Promise<void> {
      // Keep the PR-membership guard; cache hits reuse metadata verified on insertion.
      await metaFor(item);
      const path = reactionsPath(slug, item.id);
      await forgejoFetch<unknown>({ method: "POST", path, body: { content: reaction } });
    },

    async removeReactions(item: FeedbackItemRef, reactions: ReactionContent[]): Promise<void> {
      // Keep the PR-membership guard; cache hits reuse metadata verified on insertion.
      await metaFor(item);
      const path = reactionsPath(slug, item.id);

      for (const reaction of reactions) {
        await forgejoFetch<unknown>({ method: "DELETE", path, body: { content: reaction } });
      }
    },

    async complete(item, outcome): Promise<CapabilityResult> {
      return completeForgejoItem(slug, item, outcome);
    },

    async unresolve(item: FeedbackItemRef): Promise<CapabilityResult> {
      return reopenForgejoItem(slug, item);
    },
  };
}
