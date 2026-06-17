import { describe, it, expect } from "vitest";
import { groupReviewCommentConversations } from "./forgejo-conversations.js";
import { ForgejoReviewComment } from "./forgejo-schemas.js";

function comment(fields: Record<string, unknown>): ForgejoReviewComment {
  return ForgejoReviewComment.parse(fields);
}

describe("groupReviewCommentConversations", () => {
  it("nests a marked reply under the comment it answered", () => {
    const root = comment({ id: 11, path: "vault.yml", position: 141, body: "Use a vault." });
    const reply = comment({
      id: 24,
      path: "vault.yml",
      position: 141,
      body: "<!-- gh-feedback:reply-to:11 -->\n\nFixed in abc123",
    });

    const result = groupReviewCommentConversations([reply, root]);

    expect(result.length).toBe(1);
    expect(result[0]?.root.id).toBe(11);
    expect(result[0]?.replies.length).toBe(1);
    expect(result[0]?.replies[0]?.id).toBe(24);
  });

  it("keeps two distinct findings on the same line as separate items", () => {
    const first = comment({ id: 11, path: "vault.yml", position: 141, body: "Issue one." });
    const second = comment({ id: 15, path: "vault.yml", position: 141, body: "Issue two." });

    const result = groupReviewCommentConversations([first, second]);

    expect(result.length).toBe(2);
    expect(result[0]?.root.id).toBe(11);
    expect(result[1]?.root.id).toBe(15);
    expect(result[0]?.replies.length).toBe(0);
    expect(result[1]?.replies.length).toBe(0);
  });

  it("attaches a reply to its exact parent, not a co-located finding", () => {
    const first = comment({ id: 11, path: "vault.yml", position: 141, body: "Issue one." });
    const second = comment({ id: 15, path: "vault.yml", position: 141, body: "Issue two." });
    const reply = comment({
      id: 24,
      path: "vault.yml",
      position: 141,
      body: "<!-- gh-feedback:reply-to:11 -->\n\nFixed the first one.",
    });

    const result = groupReviewCommentConversations([first, second, reply]);

    expect(result.length).toBe(2);
    expect(result[0]?.root.id).toBe(11);
    expect(result[0]?.replies[0]?.id).toBe(24);
    expect(result[1]?.root.id).toBe(15);
    expect(result[1]?.replies.length).toBe(0);
  });

  it("drops a marked reply whose parent is absent so it never resurfaces", () => {
    const orphan = comment({
      id: 30,
      path: "vault.yml",
      position: 141,
      body: "<!-- gh-feedback:reply-to:99 -->\n\nAnswering a comment that's gone.",
    });

    const result = groupReviewCommentConversations([orphan]);

    expect(result.length).toBe(0);
  });
});
