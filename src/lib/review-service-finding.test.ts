import { describe, expect, it } from "vitest";
import { parseReviewServiceFinding } from "./review-service-finding.js";

const claim = "01M71ZA6QAKR3HA7G41W0553BN";
const other = "01M71ZA6QAKR3HA7G41W0553BP";
const review = "01M71ZA6QAKR3HA7G41W0553BQ";
const body = (marker: string, identity: string): string =>
  `<!-- review:claim:${marker} -->\n**High** Title\n\n${identity}\n`;
const identity = `claim \`${claim}\` of review \`${review}\``;
const actions = { id: -2 };
const comment = (overrides: Record<string, unknown> = {}) => ({
  user: actions,
  path: "src/a.ts",
  body: body(claim, identity),
  ...overrides,
});
const submitted = { user: actions, state: "COMMENT" };

describe("parseReviewServiceFinding", () => {
  it("reads the claim, review and path of a service finding", () => {
    expect(parseReviewServiceFinding(comment(), submitted)).toStrictEqual({
      claimId: claim,
      reviewId: review,
      path: "src/a.ts",
    });
  });

  it.each([
    ["marker and trailer name different claims", comment({ body: body(other, identity) })],
    ["no marker", comment({ body: `**High** Title\n\n${identity}\n` })],
    ["marker not at byte 0", comment({ body: ` ${body(claim, identity)}` })],
    ["marker without newline", comment({ body: `<!-- review:claim:${claim} -->` })],
    ["no trailer", comment({ body: `<!-- review:claim:${claim} -->\nText\n` })],
    ["trailer not alone on its line", comment({ body: body(claim, `see ${identity}`) })],
    ["human author", comment({ user: { id: 2 } })],
    ["no author id", comment({ user: { id: null } })],
    ["no path", comment({ path: null })],
  ])("rejects a comment with %s", (_name, candidate) => {
    expect(parseReviewServiceFinding(candidate, submitted)).toBeUndefined();
  });

  it.each([
    ["a pending review", { user: actions, state: "PENDING" }],
    ["a human review", { user: { id: 2 }, state: "COMMENT" }],
  ])("rejects a comment in %s", (_name, candidate) => {
    expect(parseReviewServiceFinding(comment(), candidate)).toBeUndefined();
  });
});
