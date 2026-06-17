import { describe, it, expect } from "vitest";
import {
  forgejoThreadReplyBody,
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
    expect(forgejoThreadReplyBody(comment, "Fixed in abc123")).toEqual({
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
    expect(forgejoThreadReplyBody(comment, "noted")).toEqual({
      body: "<!-- gh-feedback:reply-to:12 -->\n\nnoted",
      path: "src/app.ts",
      old_position: 87,
    });
  });

  it("omits the line for a file-level comment with neither side set", () => {
    const comment = ForgejoReviewComment.parse({ id: 13, path: "README.md" });
    expect(forgejoThreadReplyBody(comment, "thanks")).toEqual({
      body: "<!-- gh-feedback:reply-to:13 -->\n\nthanks",
      path: "README.md",
    });
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
    expect(threadReplyParentId("A regular review finding.")).toBe(undefined);
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

  it("leaves an unmarked comment unchanged", () => {
    expect(stripThreadReplyMarker("A regular review finding.")).toBe("A regular review finding.");
  });
});
