import { describe, expect, it } from "vitest";
import { findSummaryReport, parseReviewStamp } from "./parse-review-summary.js";

const head = "4b7c2cc7df24b4f275d396c0f956f27e06b2a060";
const id = "01M71ZA6QAKR3HA7G41W0553BN";
const stampedBody = `<!-- review:summary -->\n**Review** \`${id}\` — head \`${head}\`\n\n# Review`;
const actions = { id: -2 };

describe("findSummaryReport", () => {
  it("returns null without a summary", () => {
    expect(findSummaryReport([{ id: 1, user: actions, body: "hello" }])).toBeNull();
  });

  it("ignores a marker from another author", () => {
    expect(findSummaryReport([{ id: 1, user: { id: 5 }, body: stampedBody }])).toBeNull();
  });

  it("ignores a marker that is not at byte 0", () => {
    expect(findSummaryReport([{ id: 1, user: actions, body: ` ${stampedBody}` }])).toBeNull();
  });

  it("takes the lowest id of two candidates", () => {
    expect(
      findSummaryReport([
        { id: 9, user: actions, body: stampedBody },
        { id: 4, user: actions, body: stampedBody, updated_at: "2026-11-10T05:36:22Z" },
      ]),
    ).toStrictEqual({
      commentId: 4,
      updatedAt: "2026-11-10T05:36:22Z",
      stamp: { reviewId: id, head },
    });
  });

  it("reports a null stamp for the fork-skip block", () => {
    expect(
      findSummaryReport([
        { id: 3, user: actions, body: "<!-- review:summary -->\nSkipped: fork PR\n" },
      ]),
    ).toStrictEqual({ commentId: 3, updatedAt: null, stamp: null });
  });
});

describe("parseReviewStamp", () => {
  it("parses a stamp and rejects a malformed head", () => {
    expect(parseReviewStamp(stampedBody)).toStrictEqual({ reviewId: id, head });
    expect(parseReviewStamp(stampedBody.replace("4b7c", "4B7C"))).toBeNull();
  });
});
