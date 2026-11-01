import { deriveConversations, normalizeInlineComment } from "./feedback-model.js";
import { describe, it, expect } from "vitest";
import {
  reviewCommentConversationIdentity,
  reviewCommentDisplayLine,
  reviewCommentLine,
} from "./forgejo-review-comment-line.js";
import { ForgejoSnapshotReviewComment, ForgejoReviewComment } from "./forgejo-schemas.js";

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

describe("snapshot and native coordinate input contracts", () => {
  it("preserves snapshot raw integers without relaxing the native input policy", () => {
    const raw = ForgejoSnapshotReviewComment.parse({
      id: 1,
      position: -1,
      original_position: 5,
      path: "file.ts",
    });
    expect(normalizeInlineComment(raw, 7, "viewer", []).comment).toMatchObject({
      position: -1,
      originalPosition: 5,
      side: "new",
      displayLine: -1,
    });
    expect(reviewCommentDisplayLine(ForgejoReviewComment.parse(raw))).toBe(-5);
  });

  it("pairs the native anchor resolver with all comments sharing its signed line", () => {
    const zero = ForgejoSnapshotReviewComment.parse({
      id: 1,
      pull_request_review_id: 7,
      path: "file.ts",
      position: 0,
      original_position: 0,
      extra_lines_count: 2,
      created_at: "2026-01-01T00:00:00Z",
      resolver: { id: 9, login: "resolver" },
    });
    const added = ForgejoSnapshotReviewComment.parse({
      id: 2,
      pull_request_review_id: 7,
      path: "file.ts",
      position: 2,
      original_position: 0,
      created_at: "2026-01-02T00:00:00Z",
    });
    expect(reviewCommentConversationIdentity(ForgejoReviewComment.parse(zero))).toBe(
      "7\u00002\u0000file.ts",
    );
    expect(reviewCommentConversationIdentity(ForgejoReviewComment.parse(added))).toBe(
      "7\u00002\u0000file.ts",
    );
    expect(
      deriveConversations([
        normalizeInlineComment(zero, 7, "viewer", []),
        normalizeInlineComment(added, 7, "viewer", []),
      ]),
    ).toMatchObject([
      {
        anchorId: 1,
        side: "zero",
        displayLine: 2,
        resolver: { id: 9, login: "resolver" },
        comments: [
          { id: 1, side: "zero", position: 0, originalPosition: 0, extraLinesCount: 2 },
          { id: 2, side: "new", position: 2, originalPosition: 0, extraLinesCount: 0 },
        ],
      },
    ]);
  });

  it("isolates missing native metadata before snapshot defaults can invent a shared identity", () => {
    const comments = [
      { id: 1, pull_request_review_id: 7, path: "file.ts" },
      {
        id: 2,
        pull_request_review_id: 7,
        path: "file.ts",
        position: null,
        original_position: null,
      },
      { id: 3, path: "file.ts", position: 0, original_position: 0 },
      { id: 4, pull_request_review_id: 7, position: 0, original_position: 0 },
      { id: 5, pull_request_review_id: 7, path: "file.ts", position: -1, original_position: 0 },
    ].map((raw) =>
      normalizeInlineComment(ForgejoSnapshotReviewComment.parse(raw), 7, "viewer", []),
    );
    expect(comments.map(({ nativeIdentity }) => nativeIdentity)).toStrictEqual([
      null,
      null,
      null,
      null,
      null,
    ]);
    expect(
      deriveConversations(comments).map(({ anchorId, comments: bucket }) => ({
        anchorId,
        ids: bucket.map(({ id }) => id),
      })),
    ).toStrictEqual([
      { anchorId: 4, ids: [4] },
      { anchorId: 5, ids: [5] },
      { anchorId: 1, ids: [1] },
      { anchorId: 2, ids: [2] },
      { anchorId: 3, ids: [3] },
    ]);
  });
});
