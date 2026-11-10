import { describe, expect, it } from "vitest";
import { stripForgejoReplyPrefix } from "./forgejo-reply.js";

describe("stripForgejoReplyPrefix", () => {
  it("returns the text of a fallback reply to the item", () => {
    expect(
      stripForgejoReplyPrefix("> Replying to review comment #5\n\nNot a defect", {
        type: "thread",
        id: 5,
      }),
    ).toBe("Not a defect");
  });

  it("rejects a reply to another item", () => {
    expect(
      stripForgejoReplyPrefix("> Replying to review comment #6\n\nNot a defect", {
        type: "thread",
        id: 5,
      }),
    ).toBeUndefined();
  });
});
