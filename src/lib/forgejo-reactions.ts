import type { ReactionContent, Reaction } from "./types.js";
import { ForgejoReaction } from "./forgejo-schemas.js";
import { forgejoFetch, isForgejoNotFound } from "./forgejo-cli.js";

const reactionContents = new Set<string>([
  "+1",
  "-1",
  "laugh",
  "confused",
  "heart",
  "hooray",
  "rocket",
  "eyes",
]);

/**
 * Reaction endpoint for an item's native backing comment. Inline review
 * comments and PR issue comments share Forgejo's comment table, so both react
 * via `issues/comments/{id}/reactions` (verified against Forgejo's API routes —
 * there is no `pulls/comments/{id}/reactions`). Review bodies use their backing comment IDs.
 */
export function reactionsPath(slug: string, id: number): string {
  return `repos/${slug}/issues/comments/${id}/reactions`;
}

export async function fetchReactions(slug: string, id: number): Promise<ForgejoReaction[]> {
  const path = reactionsPath(slug, id);
  try {
    const raw = await forgejoFetch<unknown[]>({ path });
    if (!Array.isArray(raw)) {
      return [];
    }
    return raw.map((r) => ForgejoReaction.parse(r));
  } catch (error) {
    if (isForgejoNotFound(error)) {
      return [];
    }
    throw error;
  }
}

export function toReactionSummary(reactions: readonly ForgejoReaction[]): Reaction[] {
  const counts = new Map<string, { count: number; users: string[] }>();
  for (const reaction of reactions) {
    const existing = counts.get(reaction.content) ?? { count: 0, users: [] };
    existing.count += 1;
    if (reaction.user?.login) {
      existing.users.push(reaction.user.login);
    }
    counts.set(reaction.content, existing);
  }
  return [...counts.entries()].map(([content, { count, users }]) => ({
    content,
    count,
    viewerHasReacted: false,
    users,
  }));
}

/**
 * Reactions the viewer added, as CLI reaction strings, for status reconciliation.
 */
export function viewerReactionStrings(
  reactions: readonly ForgejoReaction[],
  viewer: string,
): ReactionContent[] {
  const result = new Set<ReactionContent>();
  for (const reaction of reactions) {
    if (reaction.user?.login !== viewer) {
      continue;
    }
    if (reactionContents.has(reaction.content)) {
      result.add(reaction.content as ReactionContent);
    }
  }
  return [...result];
}
