import { describe, expect, it } from "vitest";
import { ServiceClaim, parseCoverage, parseNewestPass } from "./parse-review-service-responses.js";

describe("parseNewestPass", () => {
  it("reports no pass for an empty list", () => {
    expect(parseNewestPass({ passes: [] })).toBeUndefined();
  });

  it("takes the last listed pass as the newest", () => {
    expect(
      parseNewestPass({
        passes: [
          { id: "OLD", sealed_at: "2026-11-10T05:00:00.000Z" },
          { id: "NEW", sealed_at: null },
        ],
      }),
    ).toStrictEqual({ id: "NEW", sealedAt: null });
  });
});

describe("parseCoverage", () => {
  it("reads each slot's unit status and loss", () => {
    expect(
      parseCoverage({
        complete: false,
        slots: [
          {
            lens: "general-bug",
            part: "whole",
            arm: "default",
            unit_status: "unit-failed",
            completed_with_loss: true,
          },
        ],
      }),
    ).toStrictEqual({
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

describe("ServiceClaim", () => {
  it("reads the claim's anchor path", () => {
    expect(
      ServiceClaim.parse({
        id: "C1",
        severity: "high",
        title: "Bug",
        anchor: { path: "src/a.ts" },
      }),
    ).toStrictEqual({ id: "C1", severity: "high", title: "Bug", path: "src/a.ts" });
  });

  it("reports a claim without an anchor path as null", () => {
    expect(
      ServiceClaim.parse({ id: "C2", severity: "low", title: "Docs", anchor: {} }),
    ).toStrictEqual({ id: "C2", severity: "low", title: "Docs", path: null });
  });
});
