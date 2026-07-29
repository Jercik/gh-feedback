import { describe, it, expect } from "vitest";
import { reviewCommentDisplayLine, reviewCommentLine } from "./forgejo-review-comment-line.js";
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

  it("keeps stored line zero for grouping but omits it from user-facing locations", () => {
    const comment = ForgejoReviewComment.parse({ id: 1, position: 0, original_position: 0 });
    expect(reviewCommentDisplayLine(comment)).toBe(0);
    expect(reviewCommentLine(comment)).toBeNull();
  });

  it("applies a stored line-zero range offset", () => {
    const comment = ForgejoReviewComment.parse({
      id: 1,
      position: 0,
      original_position: 0,
      extra_lines_count: 2,
    });
    expect(reviewCommentDisplayLine(comment)).toBe(2);
    expect(reviewCommentLine(comment)).toBeNull();
  });

  it("uses the final display line and preserves the old-side sign for grouping", () => {
    const newSide = ForgejoReviewComment.parse({
      id: 1,
      position: 20,
      original_position: 0,
      extra_lines_count: 3,
    });
    const oldSide = ForgejoReviewComment.parse({
      id: 2,
      position: 0,
      original_position: 20,
      extra_lines_count: 3,
    });
    expect(reviewCommentDisplayLine(newSide)).toBe(23);
    expect(reviewCommentDisplayLine(oldSide)).toBe(-23);
  });
});
