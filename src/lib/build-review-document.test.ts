import { describe, expect, it } from "vitest";
import { classifyNewestPass, toReviewClaim, toSealedPassFact } from "./build-review-document.js";

describe("classifyNewestPass", () => {
  it("reports none without a pass", () => {
    expect(classifyNewestPass(undefined)).toStrictEqual({ state: "none" });
  });

  it("reports an unsealed pass as pending", () => {
    expect(classifyNewestPass({ id: "NEW", sealedAt: null })).toStrictEqual({
      state: "pending",
      id: "NEW",
    });
  });

  it("reports a sealed pass with its seal time", () => {
    expect(classifyNewestPass({ id: "P2", sealedAt: "2026-11-10T05:36:45.478Z" })).toStrictEqual({
      state: "sealed",
      id: "P2",
      sealedAt: "2026-11-10T05:36:45.478Z",
    });
  });
});

describe("toSealedPassFact", () => {
  it("adds the pass coverage", () => {
    expect(
      toSealedPassFact(
        { state: "sealed", id: "P2", sealedAt: "2026-11-10T05:36:45.478Z" },
        {
          complete: false,
          slots: [
            {
              lens: "general-bug",
              part: "whole",
              arm: "default",
              unitStatus: "unit-failed",
              completedWithLoss: true,
            },
          ],
        },
      ),
    ).toStrictEqual({
      state: "sealed",
      id: "P2",
      sealedAt: "2026-11-10T05:36:45.478Z",
      complete: false,
      slots: [
        {
          lens: "general-bug",
          part: "whole",
          arm: "default",
          unitStatus: "unit-failed",
          completedWithLoss: true,
        },
      ],
    });
  });
});

describe("toReviewClaim", () => {
  it("keeps the claim's identity, severity, title and path", () => {
    expect(
      toReviewClaim({ id: "C1", severity: "high", title: "Bug", path: "src/a.ts" }),
    ).toStrictEqual({ id: "C1", severity: "high", title: "Bug", path: "src/a.ts" });
  });
});
