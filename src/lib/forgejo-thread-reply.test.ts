import { describe, it, expect } from "vitest";
import {
  forgejoThreadReplyBody,
  hasThreadablePosition,
  threadReplyParentId,
  stripThreadReplyMarker,
} from "./forgejo-thread-reply.js";
import { ForgejoReviewComment } from "./forgejo-schemas.js";

describe("forgejoThreadReplyBody", () => {
  it("replies on the new (added) side via new_position", () => {
    const comment = ForgejoReviewComment.parse({
      id: 11,
      path: "group_vars/all/vault.yml.example",
      position: 141,
      original_position: 0,
    });
    expect(forgejoThreadReplyBody(comment, "Fixed in abc123")).toStrictEqual({
      body: "<!-- gh-feedback:reply-to:11 -->\n\nFixed in abc123",
      path: "group_vars/all/vault.yml.example",
      new_position: 141,
    });
  });

  it("replies on the old (removed) side via old_position", () => {
    const comment = ForgejoReviewComment.parse({
      id: 12,
      path: "src/app.ts",
      position: 0,
      original_position: 87,
    });
    expect(forgejoThreadReplyBody(comment, "noted")).toStrictEqual({
      body: "<!-- gh-feedback:reply-to:12 -->\n\nnoted",
      path: "src/app.ts",
      old_position: 87,
    });
  });

  it("preserves a multi-line parent's range", () => {
    const comment = ForgejoReviewComment.parse({
      id: 13,
      path: "src/app.ts",
      position: 18,
      original_position: 0,
      extra_lines_count: 2,
    });
    expect(forgejoThreadReplyBody(comment, "fixed")).toStrictEqual({
      body: "<!-- gh-feedback:reply-to:13 -->\n\nfixed",
      path: "src/app.ts",
      new_position: 18,
      extra_lines_count: 2,
    });
  });
});

describe("hasThreadablePosition", () => {
  it("is true with a diff position and false for a file-level comment", () => {
    const results = {
      newSide: hasThreadablePosition(ForgejoReviewComment.parse({ id: 11, position: 141 })),
      oldSide: hasThreadablePosition(ForgejoReviewComment.parse({ id: 12, original_position: 87 })),
      fileLevel: hasThreadablePosition(ForgejoReviewComment.parse({ id: 13, path: "README.md" })),
    };
    expect(results).toStrictEqual({ newSide: true, oldSide: true, fileLevel: false });
  });
});

describe("threadReplyParentId", () => {
  it("reads the parent id from a marked reply", () => {
    expect(threadReplyParentId("<!-- gh-feedback:reply-to:11 -->\n\nFixed in abc123")).toBe(11);
  });

  it("reads the parent id when the body is stored with CRLF newlines", () => {
    expect(threadReplyParentId("<!-- gh-feedback:reply-to:11 -->\r\n\r\nFixed in abc123")).toBe(11);
  });

  it("returns undefined for an unmarked comment", () => {
    expect(threadReplyParentId("A regular review finding.")).toBeUndefined();
  });
});

describe("stripThreadReplyMarker", () => {
  it("removes the marker for display", () => {
    expect(stripThreadReplyMarker("<!-- gh-feedback:reply-to:11 -->\n\nFixed in abc123")).toBe(
      "Fixed in abc123",
    );
  });

  it("removes the marker when the body is stored with CRLF newlines", () => {
    expect(stripThreadReplyMarker("<!-- gh-feedback:reply-to:11 -->\r\n\r\nFixed in abc123")).toBe(
      "Fixed in abc123",
    );
  });

  it("preserves leading whitespace in the reply message", () => {
    expect(stripThreadReplyMarker("<!-- gh-feedback:reply-to:11 -->\n\n    indented code")).toBe(
      "    indented code",
    );
  });

  it("leaves an unmarked comment unchanged", () => {
    expect(stripThreadReplyMarker("A regular review finding.")).toBe("A regular review finding.");
  });
});
