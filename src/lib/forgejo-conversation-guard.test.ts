import { describe, expect, it } from "vitest";
import { ForgejoReviewComment } from "./forgejo-schemas.js";
import {
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
  });

  it("keeps different reviews and old/new sides separate", () => {
    expect(sameForgejoNativeConversation(comment(), comment({ pull_request_review_id: 8 }))).toBe(
      false,
    );
    expect(
      sameForgejoNativeConversation(comment(), comment({ position: 0, original_position: 20 })),
    ).toBe(false);
  });
});
