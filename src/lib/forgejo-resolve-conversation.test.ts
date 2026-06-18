import { describe, it, expect } from "vitest";
import {
  buildResolveConversationRequest,
  reviewCommentIsResolved,
} from "./forgejo-resolve-conversation.js";
import { ForgejoReviewComment } from "./forgejo-schemas.js";

describe("buildResolveConversationRequest", () => {
  it("targets the web resolve route with the root comment id and Resolve action", () => {
    expect(buildResolveConversationRequest("j4k/cluster", 11, "Resolve")).toEqual({
      route: "j4k/cluster/issues/resolve_conversation",
      form: { comment_id: "11", action: "Resolve", origin: "diff" },
    });
  });

  it("sends UnResolve to reopen a conversation", () => {
    expect(buildResolveConversationRequest("Jercik/repo", 87, "UnResolve")).toEqual({
      route: "Jercik/repo/issues/resolve_conversation",
      form: { comment_id: "87", action: "UnResolve", origin: "diff" },
    });
  });
});

describe("reviewCommentIsResolved", () => {
  it("is true only when the comment carries a resolver", () => {
    const results = {
      withResolver: reviewCommentIsResolved(
        ForgejoReviewComment.parse({ id: 13, resolver: { login: "jercik" } }),
      ),
      nullResolver: reviewCommentIsResolved(ForgejoReviewComment.parse({ id: 11, resolver: null })),
      absentResolver: reviewCommentIsResolved(ForgejoReviewComment.parse({ id: 14 })),
      undefinedComment: reviewCommentIsResolved(undefined),
    };
    expect(results).toStrictEqual({
      withResolver: true,
      nullResolver: false,
      absentResolver: false,
      undefinedComment: false,
    });
  });
});
