import { describe, expect, it } from "vitest";
import { ForgejoReviewComment } from "./forgejo-schemas.js";
import {
  isForgejoSiblingSettledForResolution,
  forgejoNativeConversationAnchor,
  sameForgejoNativeConversation,
} from "./forgejo-conversation-guard.js";

const comment = (overrides: Record<string, unknown> = {}) =>
  ForgejoReviewComment.parse({
    id: 1,
    pull_request_review_id: 7,
    path: "src/a.ts",
    position: 20,
    original_position: 0,
    ...overrides,
  });

describe("isForgejoSiblingSettledForResolution", () => {
  it.each([["+1"], ["rocket"]])("accepts one settled reaction: %s", (...reactions) => {
    expect(isForgejoSiblingSettledForResolution(reactions)).toBe(true);
  });

  it.each([[], ["eyes"], ["confused"], ["-1"], ["+1", "rocket"]])(
    "rejects unsettled or conflicting reactions: %s",
    (...reactions) => {
      expect(isForgejoSiblingSettledForResolution(reactions)).toBe(false);
    },
  );
});

describe("sameForgejoNativeConversation", () => {
  it("groups comments by review, path, side, and final display line", () => {
    expect(sameForgejoNativeConversation(comment(), comment({ id: 2 }))).toBe(true);
    expect(
      sameForgejoNativeConversation(
        comment({ position: 18, extra_lines_count: 2 }),
        comment({ id: 2 }),
      ),
    ).toBe(true);
  });

  it("keeps different reviews and old/new sides separate", () => {
    expect(sameForgejoNativeConversation(comment(), comment({ pull_request_review_id: 8 }))).toBe(
      false,
    );
    expect(
      sameForgejoNativeConversation(comment(), comment({ position: 0, original_position: 20 })),
    ).toBe(false);
  });

  it("fails closed when a native grouping key is unavailable", () => {
    expect(
      sameForgejoNativeConversation(comment(), comment({ pull_request_review_id: null })),
    ).toBe(false);
    expect(sameForgejoNativeConversation(comment(), comment({ path: null }))).toBe(false);
    expect(
      sameForgejoNativeConversation(
        comment(),
        comment({ position: null, original_position: null }),
      ),
    ).toBe(false);
  });
});

describe("forgejoNativeConversationAnchor", () => {
  it("returns the created-earliest comment and uses id as the tie breaker", () => {
    const target = comment({ id: 30, created_at: "2026-07-28T10:00:01Z" });
    const tiedEarlier = comment({ id: 10, created_at: "2026-07-28T10:00:00Z" });
    const tiedLater = comment({ id: 20, created_at: "2026-07-28T10:00:00Z" });
    expect(forgejoNativeConversationAnchor([target, tiedLater, tiedEarlier], target)?.id).toBe(10);
  });
});
