/**
 * Forgejo reactions: raw strings ("+1", "rocket") via the REST reactions
 * endpoints. To reuse the shared status derivation (which keys on GraphQL enum
 * names), convert raw reactions into the { content, viewerHasReacted } shape
 * reactionToStatus expects.
 */

import { REACTION_TO_GRAPHQL } from "./constants.js";
import type { ReactionContent, Reaction } from "./types.js";
import { ForgejoReaction } from "./forgejo-schemas.js";
import { forgejoFetch } from "./forgejo-cli.js";
import { isForgejoNotFound } from "./forgejo-http.js";
import type { ForgejoItemKind } from "./forgejo-item.js";

interface NormalizedReaction {
  content: string;
  viewerHasReacted: boolean;
}

/**
 * Reaction endpoint for an item, or undefined where none exists. Inline review
 * comments and PR issue comments share Forgejo's comment table, so both react
 * via `issues/comments/{id}/reactions` (verified against Forgejo's API routes —
 * there is no `pulls/comments/{id}/reactions`). Reviews have no endpoint.
 */
export function reactionsPath(slug: string, kind: ForgejoItemKind, id: number): string | undefined {
  if (kind === "issue-comment" || kind === "review-comment") {
    return `repos/${slug}/issues/comments/${id}/reactions`;
  }
  return undefined;
}

export async function fetchReactions(
  slug: string,
  kind: ForgejoItemKind,
  id: number,
): Promise<ForgejoReaction[]> {
  const path = reactionsPath(slug, kind, id);
  if (!path) {
    return [];
  }

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

function isFinalStatusReaction(content: string): boolean {
  return content === "+1" || content === "-1" || content === "rocket";
}

export function deriveIsDone(reactions: readonly ForgejoReaction[], viewer: string): boolean {
  return reactions.some((r) => r.user?.login === viewer && isFinalStatusReaction(r.content));
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
 * Convert raw Forgejo reactions into GraphQL-enum-keyed groups so the shared
 * reactionToStatus can consume them. `viewer` is the authenticated login used
 * to decide viewerHasReacted.
 */
export function normalizeForgejoReactions(
  reactions: readonly ForgejoReaction[],
  viewer: string,
): NormalizedReaction[] {
  const groups = new Map<string, boolean>();

  for (const reaction of reactions) {
    const enumName = REACTION_TO_GRAPHQL[reaction.content as ReactionContent];
    if (!enumName) {
      continue;
    }
    const viewerReacted = reaction.user?.login === viewer;
    groups.set(enumName, (groups.get(enumName) ?? false) || viewerReacted);
  }

  return [...groups.entries()].map(([content, viewerHasReacted]) => ({
    content,
    viewerHasReacted,
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
    if (reaction.content in REACTION_TO_GRAPHQL) {
      result.add(reaction.content as ReactionContent);
    }
  }
  return [...result];
}
