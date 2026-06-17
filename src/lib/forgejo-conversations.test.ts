import { describe, it, expect } from "vitest";
import { groupReviewCommentConversations } from "./forgejo-conversations.js";
import { ForgejoReviewComment } from "./forgejo-schemas.js";

function comment(fields: Record<string, unknown>): ForgejoReviewComment {
  return ForgejoReviewComment.parse(fields);
}

describe("groupReviewCommentConversations", () => {
  it("nests the viewer's own reply under its root, earliest id first", () => {
    const root = comment({
      id: 11,
      pull_request_review_id: 2,
      path: "vault.yml",
      position: 141,
      user: { login: "forgejo-actions" },
    });
    const reply = comment({
      id: 24,
      pull_request_review_id: 2,
      path: "vault.yml",
      position: 141,
      user: { login: "jercik" },
    });

    const result = groupReviewCommentConversations([reply, root], "jercik");

    expect(result.length).toBe(1);
    expect(result[0]?.root.id).toBe(11);
    expect(result[0]?.replies.length).toBe(1);
    expect(result[0]?.replies[0]?.id).toBe(24);
  });

  it("keeps two distinct findings from one review on the same line apart", () => {
    const first = comment({
      id: 11,
      pull_request_review_id: 2,
      path: "vault.yml",
      position: 141,
      user: { login: "forgejo-actions" },
    });
    const second = comment({
      id: 15,
      pull_request_review_id: 2,
      path: "vault.yml",
      position: 141,
      user: { login: "forgejo-actions" },
    });

    const result = groupReviewCommentConversations([first, second], "jercik");

    expect(result.length).toBe(2);
    expect(result[0]?.root.id).toBe(11);
    expect(result[1]?.root.id).toBe(15);
    expect(result[0]?.replies.length).toBe(0);
    expect(result[1]?.replies.length).toBe(0);
  });

  it("keeps co-located comments from different reviews as distinct findings", () => {
    const first = comment({ id: 11, pull_request_review_id: 2, path: "vault.yml", position: 141 });
    const second = comment({ id: 15, pull_request_review_id: 3, path: "vault.yml", position: 141 });

    const result = groupReviewCommentConversations([first, second], "jercik");

    expect(result.length).toBe(2);
    expect(result[0]?.root.id).toBe(11);
    expect(result[1]?.root.id).toBe(15);
    expect(result[0]?.replies.length).toBe(0);
    expect(result[1]?.replies.length).toBe(0);
  });

  it("keys a comment missing a review id to itself so it stands alone", () => {
    const first = comment({ id: 30, path: "vault.yml", position: 141 });
    const second = comment({ id: 31, path: "vault.yml", position: 141 });

    const result = groupReviewCommentConversations([first, second], "jercik");

    expect(result.length).toBe(2);
    expect(result[0]?.root.id).toBe(30);
    expect(result[1]?.root.id).toBe(31);
  });
});
