import { describe, expect, it } from "vitest";
import { ForgejoReviewComment } from "./forgejo-schemas.js";
import {
  forgejoNativeConversationAnchor,
  forgejoNativeConversationSiblingRoots,
  hasForgejoNativeConversationKey,
  isForgejoSiblingSettledForResolution,
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
    expect(
      sameForgejoNativeConversation(
        comment({ position: 0, original_position: 0 }),
        comment({ id: 2, position: 0, original_position: 0 }),
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

describe("hasForgejoNativeConversationKey", () => {
  it("requires the review, path, and display line", () => {
    expect(hasForgejoNativeConversationKey(comment())).toBe(true);
    expect(hasForgejoNativeConversationKey(comment({ pull_request_review_id: null }))).toBe(false);
    expect(hasForgejoNativeConversationKey(comment({ path: null }))).toBe(false);
    expect(
      hasForgejoNativeConversationKey(comment({ position: null, original_position: null })),
    ).toBe(false);
  });
});

describe("forgejoNativeConversationSiblingRoots", () => {
  it("returns same-review siblings at the native display line", () => {
    expect(
      forgejoNativeConversationSiblingRoots(
        [comment(), comment({ id: 2 }), comment({ id: 3, pull_request_review_id: 8 })],
        "codex",
        1,
      )?.map(({ id }) => id),
    ).toStrictEqual([2]);
  });

  it("refuses readiness when the target is missing or ignored", () => {
    expect(forgejoNativeConversationSiblingRoots([comment()], "codex", 2)).toBeUndefined();
    expect(
      forgejoNativeConversationSiblingRoots([comment({ user: { login: "vercel" } })], "codex", 1),
    ).toBeUndefined();
  });

  it("refuses readiness when native grouping data is incomplete", () => {
    expect(
      forgejoNativeConversationSiblingRoots(
        [comment(), comment({ id: 2, path: null })],
        "codex",
        1,
      ),
    ).toBeUndefined();
  });
});

describe("forgejoNativeConversationAnchor", () => {
  it("uses the lowest monotonic comment id even when a timestamp is missing", () => {
    const target = comment({ id: 30, created_at: "" });
    const earlier = comment({ id: 10, created_at: "2026-07-28T10:00:01Z" });
    const middle = comment({ id: 20, created_at: "2026-07-28T10:00:00Z" });
    expect(forgejoNativeConversationAnchor([target, middle, earlier], target)?.id).toBe(10);
  });
});
