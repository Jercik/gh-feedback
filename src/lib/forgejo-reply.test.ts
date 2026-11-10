import { describe, expect, it } from "vitest";
import { forgejoReplyRoute, stripForgejoReplyPrefix } from "./forgejo-reply.js";
import { ForgejoReviewComment } from "./forgejo-schemas.js";

describe("forgejoReplyRoute", () => {
  it("threads a reply under a positioned comment of a known review", () => {
    const comment = ForgejoReviewComment.parse({ id: 5, position: 3, pull_request_review_id: 10 });
    expect(forgejoReplyRoute({ type: "thread" }, comment)).toStrictEqual({
      kind: "thread",
      reviewId: 10,
      reviewComment: comment,
    });
  });

  it("posts an issue comment for a positioned comment without a review", () => {
    const comment = ForgejoReviewComment.parse({
      id: 5,
      position: 3,
      pull_request_review_id: null,
    });
    expect(forgejoReplyRoute({ type: "thread" }, comment)).toStrictEqual({ kind: "issue-comment" });
  });

  it("posts an issue comment for a comment without a diff position", () => {
    const comment = ForgejoReviewComment.parse({ id: 5, position: 0, pull_request_review_id: 10 });
    expect(forgejoReplyRoute({ type: "thread" }, comment)).toStrictEqual({ kind: "issue-comment" });
  });
});

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
