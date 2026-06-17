import { describe, it, expect } from "vitest";
import { reviewCommentLine } from "./forgejo-review-comment-line.js";
import { ForgejoReviewComment } from "./forgejo-schemas.js";

describe("reviewCommentLine", () => {
  it("uses position for a comment on the new (added) side", () => {
    const comment = ForgejoReviewComment.parse({ id: 1, position: 142, original_position: 0 });
    expect(reviewCommentLine(comment)).toBe(142);
  });

  it("falls back to original_position for a comment on the old (removed) side", () => {
    const comment = ForgejoReviewComment.parse({ id: 1, position: 0, original_position: 87 });
    expect(reviewCommentLine(comment)).toBe(87);
  });

  it("returns null when neither side carries a line", () => {
    const comment = ForgejoReviewComment.parse({ id: 1 });
    expect(reviewCommentLine(comment)).toBeNull();
  });
});
