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

describe("acknowledgeItem", () => {
  it("restores reactions when a sequential removal fails partway through", async () => {
    const reactions = new Set<ReactionContent>(["eyes", "confused"]);
    const backend = {
      removeReactions: vi.fn(
        (
          _item: FeedbackItemRef,
          _viewerReactions: ReactionContent[],
          toRemove: ReactionContent[],
        ): Promise<void> => {
          for (const reaction of toRemove) {
            if (!reactions.has(reaction)) {
              continue;
            }
            if (reaction === "confused") {
              return Promise.reject(new Error("second removal failed"));
            }
            reactions.delete(reaction);
          }
          return Promise.resolve();
        },
      ),
      addReaction: vi.fn((_item: FeedbackItemRef, reaction: ReactionContent) => {
        reactions.add(reaction);
        return Promise.resolve();
      }),
      complete: vi.fn(),
    } as unknown as FeedbackBackend;

    await expect(acknowledgeItem(backend, item, ["eyes", "confused"])).rejects.toThrow(
      "second removal failed",
    );
    expect([...reactions].toSorted()).toStrictEqual(["confused", "eyes"]);
    expect(backend.complete).not.toHaveBeenCalled();
  });
});
