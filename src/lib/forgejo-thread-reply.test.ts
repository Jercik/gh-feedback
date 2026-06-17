import { describe, it, expect } from "vitest";
import { forgejoThreadReplyBody } from "./forgejo-thread-reply.js";
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
      body: "Fixed in abc123",
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
      body: "noted",
      path: "src/app.ts",
      old_position: 87,
    });
  });

  it("omits the line for a file-level comment with neither side set", () => {
    const comment = ForgejoReviewComment.parse({ id: 13, path: "README.md" });
    expect(forgejoThreadReplyBody(comment, "thanks")).toEqual({
      body: "thanks",
      path: "README.md",
    });
  });
});
