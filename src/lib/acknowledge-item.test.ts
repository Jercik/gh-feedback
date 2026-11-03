import { describe, expect, it, vi } from "vitest";
import type { FeedbackBackend, FeedbackItemRef } from "./feedback-backend.js";
import { acknowledgeItem } from "./acknowledge-item.js";
import type { ReactionContent } from "./types.js";

const item: FeedbackItemRef = {
  type: "thread",
  id: 1,
  author: "reviewer",
  prNumber: 2,
  path: "src/a.ts",
  line: 3,
};

function reactionBackend(
  reactions: Set<ReactionContent>,
  failingRemoval: ReactionContent | undefined,
  complete: () => Promise<unknown>,
): FeedbackBackend {
  return {
    removeReactions: vi.fn((_item: FeedbackItemRef, toRemove: ReactionContent[]): Promise<void> => {
      for (const reaction of toRemove) {
        if (!reactions.has(reaction)) {
          continue;
        }
        if (reaction === failingRemoval) {
          return Promise.reject(new Error("second removal failed"));
        }
        reactions.delete(reaction);
      }
      return Promise.resolve();
    }),
    addReaction: vi.fn((_item: FeedbackItemRef, reaction: ReactionContent) => {
      reactions.add(reaction);
      return Promise.resolve();
    }),
    complete: vi.fn(complete),
  } as unknown as FeedbackBackend;
}

describe("acknowledgeItem", () => {
  it("restores reactions when a sequential removal fails partway through", async () => {
    const reactions = new Set<ReactionContent>(["eyes", "confused"]);
    const backend = reactionBackend(reactions, "confused", () => Promise.resolve());

    await expect(acknowledgeItem(backend, item, ["eyes", "confused"])).rejects.toThrow(
      "second removal failed",
    );
    expect([...reactions].toSorted()).toStrictEqual(["confused", "eyes"]);
    expect(backend.complete).not.toHaveBeenCalled();
  });

  it("restores reactions when completion fails after the rocket was added", async () => {
    const reactions = new Set<ReactionContent>(["eyes"]);
    const backend = reactionBackend(reactions, undefined, () =>
      Promise.reject(new Error("resolve failed")),
    );

    await expect(acknowledgeItem(backend, item, ["eyes"])).rejects.toThrow("resolve failed");
    expect([...reactions]).toStrictEqual(["eyes"]);
  });
});
