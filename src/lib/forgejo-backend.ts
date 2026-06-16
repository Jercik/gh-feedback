/**
 * Forgejo backend: REST /api/v1 implementation of the FeedbackBackend seam.
 *
 * Forgejo has NO thread RESOLVE and NO comment MINIMIZE/hide, so the
 * resolve/unresolve capabilities DEGRADE to a clear "not supported" result and
 * the hidden axis is dropped — workflow status comes from reactions alone.
 */

import type { DetectedItem } from "./detect-item-type.js";
import type { ItemDetail } from "./fetch-item-detail.js";
import type { FeedbackSummary } from "./summary-types.js";
import type { ReactionContent } from "./types.js";
import type {
  CapabilityResult,
  FeedbackBackend,
  ItemStatus,
  ReplyResult,
  SummaryOptions,
} from "./feedback-backend.js";
import { forgejoFetch } from "./forgejo-cli.js";
import {
  fetchReactions,
  normalizeForgejoReactions,
  deriveIsDone,
  viewerReactionStrings,
} from "./forgejo-reactions.js";
import { resolveItemMeta, metaKindToItemType } from "./forgejo-item.js";
import type { ForgejoItemMeta } from "./forgejo-item.js";
import { buildSummary } from "./forgejo-summary.js";
import { buildItemDetail } from "./forgejo-item-detail.js";
import { getForgejoViewer, findForgejoPullByBranch } from "./forgejo-environment.js";
import { reactionToStatus, isStatusDone } from "./summary-types.js";
import { exitWithMessage } from "./git-helpers.js";
import { REACTION_TO_GRAPHQL } from "./constants.js";

const FORGEJO_UNSUPPORTED_RESOLVE =
  "Forgejo has no thread-resolve or comment-hide API; status is tracked by reaction only.";

function replyPrefix(itemType: DetectedItem["type"], itemId: number): string {
  if (itemType === "thread") {
    return `> Replying to review comment #${itemId}\n\n`;
  }
  if (itemType === "comment") {
    return `> Replying to comment #${itemId}\n\n`;
  }
  return `> Replying to review #${itemId}\n\n`;
}

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

  async function detect(itemId: number): Promise<DetectedItem> {
    const prNumber = await currentPrNumber();
    const resolved = await resolveItemMeta(slug, prNumber, itemId);
    if (!resolved) {
      return exitWithMessage(
        `Error: Could not find item #${itemId} in the current Forgejo PR #${prNumber}.`,
      );
    }
    metaCache.set(itemId, resolved.meta);

    const author =
      resolved.reviewComment?.user?.login ??
      resolved.issueComment?.user?.login ??
      resolved.review?.user?.login ??
      "ghost";

    return {
      type: metaKindToItemType(resolved.meta.kind),
      id: itemId,
      nodeId: String(itemId),
      author,
      prNumber,
      path: resolved.reviewComment?.path ?? null,
      line: resolved.reviewComment?.position ?? null,
    };
  }

  async function metaFor(item: DetectedItem): Promise<ForgejoItemMeta> {
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

    fetchSummary(prNumber: number, _options: SummaryOptions): Promise<FeedbackSummary> {
      return buildSummary(slug, prNumber);
    },

    async fetchItemDetail(itemId: number): Promise<ItemDetail> {
      const prNumber = await currentPrNumber();
      return buildItemDetail(slug, prNumber, itemId);
    },

    async detectItem(itemId: number): Promise<DetectedItem> {
      return detect(itemId);
    },

    async getItemStatus(item: DetectedItem): Promise<ItemStatus> {
      const meta = await metaFor(item);
      if (meta.kind === "review") {
        return { doneStatus: undefined, viewerReactions: [], isMinimized: false };
      }

      const viewer = await getForgejoViewer();
      const reactions = await fetchReactions(slug, meta.kind, item.id);
      const normalized = normalizeForgejoReactions(reactions, viewer);
      const isDone = deriveIsDone(reactions, viewer);
      const status = reactionToStatus(normalized, isDone);
      const viewerReactions = viewerReactionStrings(reactions, viewer);

      const doneStatus = isStatusDone(status)
        ? (status as "agreed" | "disagreed" | "acknowledged")
        : undefined;

      return { doneStatus, viewerReactions, isMinimized: false };
    },

    async reply(item: DetectedItem, message: string): Promise<ReplyResult> {
      // Forgejo has no native threaded-reply endpoint for review comments, so
      // replies are posted as issue comments on the PR, referencing the item.
      const prefix = replyPrefix(item.type, item.id);

      const result = await forgejoFetch<{ id: number; html_url: string }>({
        method: "POST",
        path: `repos/${slug}/issues/${item.prNumber}/comments`,
        body: { body: prefix + message },
      });
      return { id: result.id, url: result.html_url };
    },

    async addReaction(item: DetectedItem, reaction: ReactionContent): Promise<void> {
      const meta = await metaFor(item);
      if (meta.kind === "review") {
        // Reviews have no reaction endpoint in Forgejo; nothing to apply.
        return;
      }
      const path =
        meta.kind === "issue-comment"
          ? `repos/${slug}/issues/comments/${item.id}/reactions`
          : `repos/${slug}/pulls/comments/${item.id}/reactions`;
      await forgejoFetch<unknown>({ method: "POST", path, body: { content: reaction } });
    },

    async removeReactions(
      item: DetectedItem,
      viewerReactions: ReactionContent[],
      toRemove: ReactionContent[],
    ): Promise<void> {
      const meta = await metaFor(item);
      if (meta.kind === "review") {
        return;
      }
      const path =
        meta.kind === "issue-comment"
          ? `repos/${slug}/issues/comments/${item.id}/reactions`
          : `repos/${slug}/pulls/comments/${item.id}/reactions`;

      const reactionsToRemove = toRemove.filter(
        (r) => viewerReactions.includes(r) && r in REACTION_TO_GRAPHQL,
      );
      for (const reaction of reactionsToRemove) {
        await forgejoFetch<unknown>({ method: "DELETE", path, body: { content: reaction } });
      }
    },

    resolve(_item: DetectedItem): Promise<CapabilityResult> {
      return Promise.resolve({ supported: false, reason: FORGEJO_UNSUPPORTED_RESOLVE });
    },

    unresolve(_item: DetectedItem, _isMinimized: boolean): Promise<CapabilityResult> {
      return Promise.resolve({ supported: false, reason: FORGEJO_UNSUPPORTED_RESOLVE });
    },
  };
}
