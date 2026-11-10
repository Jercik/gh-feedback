import { describe, expect, it } from "vitest";
import { selectReusableReply } from "./select-reusable-reply.js";

const reply = (id: number, text: string, createdAt: string) => ({
  id,
  url: `https://forge.test/#${id}`,
  text,
  createdAt,
});

describe("selectReusableReply", () => {
  it("reuses the newest reply with the same text when nothing is recorded", () => {
    expect(
      selectReusableReply(
        [
          reply(1, "Why\n\n", "2026-11-10T10:00:00Z"),
          reply(2, "Why", "2026-11-10T11:00:00Z"),
          reply(3, "Other", "2026-11-10T12:00:00Z"),
        ],
        "Why",
        undefined,
      )?.id,
    ).toBe(2);
  });

  it("matches across CRLF line endings", () => {
    expect(
      selectReusableReply([reply(1, "a\r\nb", "2026-11-10T10:00:00Z")], "a\nb", undefined)?.id,
    ).toBe(1);
  });

  it("ignores replies posted before the current disposition", () => {
    const replies = [reply(1, "Why", "2026-11-10T10:00:00Z")];
    expect(selectReusableReply(replies, "Why", "2026-11-10T10:30:00Z")).toBeUndefined();
    expect(selectReusableReply(replies, "Why", "2026-11-10T09:30:00Z")?.id).toBe(1);
  });

  it("returns nothing when no reply matches", () => {
    expect(selectReusableReply([], "Why", undefined)).toBeUndefined();
  });
});
