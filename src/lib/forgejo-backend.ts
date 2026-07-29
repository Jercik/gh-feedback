/**
 * Forgejo backend: REST /api/v1 implementation of the FeedbackBackend seam.
 *
 * The j4k Forgejo fork resolves inline conversations through the local fgj CLI.
 * Plain issue comments still have no hide API, so their status uses reactions.
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
import { forgejoFetch } from "./forgejo-cli.js";
import { reactionsPath } from "./forgejo-reactions.js";
import { resolveItemMeta, metaKindToItemType } from "./forgejo-item.js";
import type { ForgejoItemMeta } from "./forgejo-item.js";
import { conversationRootOf } from "./forgejo-conversation-root.js";
import { buildSummary } from "./forgejo-summary.js";
import { buildItemDetail } from "./forgejo-item-detail.js";
import { reviewCommentLine } from "./forgejo-review-comment-line.js";
import { postForgejoReply } from "./forgejo-reply.js";
import { getForgejoViewer, findForgejoPullByBranch } from "./forgejo-environment.js";
import { exitWithMessage } from "./git-helpers.js";
import { REACTION_TO_GRAPHQL } from "./constants.js";
import { changeForgejoConversationResolution } from "./forgejo-resolution.js";
import { getForgejoItemStatus } from "./forgejo-item-status.js";
import { completeForgejoItem } from "./forgejo-completion.js";

export function createForgejoBackend(slug: string): FeedbackBackend {
  /** Cache the detected meta so reply/react reuse it without re-probing. */
  const metaCache = new Map<number, ForgejoItemMeta>();

  async function currentPrNumber(): Promise<number> {
    const pull = await findForgejoPullByBranch(slug);
    if (!pull) {
      return exitWithMessage("Error: No open Forgejo pull request found for the current branch.");
    }
    return pull.number;
  }

  async function detect(itemId: number): Promise<FeedbackItemRef> {
    const prNumber = await currentPrNumber();
    const resolved = await resolveItemMeta(slug, prNumber, itemId);
    if (!resolved) {
      return exitWithMessage(
        `Error: Could not find item #${itemId} in the current Forgejo PR #${prNumber}.`,
      );
    }
    if (resolved.meta.kind === "review") {
      // A Forgejo review has no reaction or resolve endpoint, so no status
      // command could leave a marker that summary reads back. Reject it before
      // any reply/reaction is posted rather than report a hollow success.
      return exitWithMessage(
        `Error: Forgejo review #${itemId} can't be tracked — a review has no reaction or resolve endpoint, so start/agree/disagree/ask/ack can't record a status. Act on its inline comments or the PR conversation instead; see the forge UI for the review body.`,
      );
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
    provider: "forgejo",

    fetchSummary(prNumber: number, options: SummaryOptions): Promise<FeedbackSummary> {
      return buildSummary(slug, prNumber, options);
    },

    async fetchItemDetail(itemId: number): Promise<ItemDetail> {
      const prNumber = await currentPrNumber();
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
      const meta = await metaFor(item);
      const path = reactionsPath(slug, meta.kind, item.id);
      if (!path) {
        // Reviews have no reaction endpoint in Forgejo; nothing to apply.
        return;
      }
      await forgejoFetch<unknown>({ method: "POST", path, body: { content: reaction } });
    },

    async removeReactions(
      item: FeedbackItemRef,
      viewerReactions: ReactionContent[],
      toRemove: ReactionContent[],
    ): Promise<void> {
      const meta = await metaFor(item);
      const path = reactionsPath(slug, meta.kind, item.id);
      if (!path) {
        return;
      }

      const reactionsToRemove = toRemove.filter(
        (r) => viewerReactions.includes(r) && r in REACTION_TO_GRAPHQL,
      );
      for (const reaction of reactionsToRemove) {
        await forgejoFetch<unknown>({ method: "DELETE", path, body: { content: reaction } });
      }
    },

    async complete(item, outcome): Promise<CapabilityResult> {
      const meta = await metaFor(item);
      return completeForgejoItem(slug, item, outcome, meta.reviewComments, meta.reviewComment);
    },

    unresolve(item: FeedbackItemRef, _isMinimized: boolean): Promise<CapabilityResult> {
      return Promise.resolve(changeForgejoConversationResolution(slug, item, "unresolve"));
    },

    blockIfUnresolvedSiblings(_item, _actionVerb): Promise<void> {
      return Promise.resolve();
    },
  };
}
