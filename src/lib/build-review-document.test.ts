import { describe, expect, it } from "vitest";
import { toPassFact } from "./build-review-document.js";

describe("toPassFact", () => {
  it("maps no pass, a pending pass, and a sealed pass", () => {
    expect(toPassFact(undefined, undefined)).toStrictEqual({ state: "none" });
    expect(toPassFact({ id: "P1", sealedAt: null }, undefined)).toStrictEqual({
      state: "pending",
      id: "P1",
    });
    expect(
      toPassFact(
        { id: "P2", sealedAt: "2026-11-10T05:36:45.478Z" },
        { complete: false, slots: [] },
      ),
    ).toStrictEqual({
      state: "sealed",
      id: "P2",
      sealedAt: "2026-11-10T05:36:45.478Z",
      complete: false,
      slots: [],
    });
  });
});
