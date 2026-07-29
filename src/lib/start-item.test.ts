import { describe, expect, it, vi } from "vitest";
import type { FeedbackBackend, FeedbackItemRef } from "./feedback-backend.js";
import { startItem } from "./start-item.js";

const item: FeedbackItemRef = {
  type: "thread",
  id: 1,
  author: "reviewer",
  prNumber: 2,
  path: "src/a.ts",
  line: 3,
};

function backendWithUnresolve(result: FeedbackBackend["unresolve"]): FeedbackBackend {
  return {
    unresolve: vi.fn(result),
    removeReactions: vi.fn().mockResolvedValue(undefined),
    addReaction: vi.fn().mockResolvedValue(undefined),
  } as unknown as FeedbackBackend;
}

describe("startItem", () => {
  it("preserves reactions when reopening is unsupported", async () => {
    const backend = backendWithUnresolve(() =>
      Promise.resolve({ supported: false, reason: "upgrade fgj" }),
    );

    await expect(startItem(backend, item, ["+1"], false, true)).rejects.toThrow(
      "Reopen skipped: upgrade fgj",
    );
    expect(backend.removeReactions).not.toHaveBeenCalled();
    expect(backend.addReaction).not.toHaveBeenCalled();
  });

  it("preserves reactions when reopening was not applied", async () => {
    const backend = backendWithUnresolve(() =>
      Promise.resolve({
        supported: true,
        applied: false,
        reason: "conversation reopen did not apply",
      }),
    );

    await expect(startItem(backend, item, ["+1"], false, true)).rejects.toThrow(
      "Reopen failed: conversation reopen did not apply",
    );
    expect(backend.removeReactions).not.toHaveBeenCalled();
    expect(backend.addReaction).not.toHaveBeenCalled();
  });

  it("swaps reactions only after reopening succeeds", async () => {
    const events: string[] = [];
    const backend = {
      unresolve: vi.fn(() => {
        events.push("unresolve");
        return Promise.resolve({ supported: true, applied: true } as const);
      }),
      removeReactions: vi.fn(() => {
        events.push("remove");
        return Promise.resolve();
      }),
      addReaction: vi.fn(() => {
        events.push("add:eyes");
        return Promise.resolve();
      }),
    } as unknown as FeedbackBackend;

    await startItem(backend, item, ["+1"], false, true);
    expect(events).toStrictEqual(["unresolve", "remove", "add:eyes"]);
  });

  it("preserves reactions when reopening throws", async () => {
    const backend = backendWithUnresolve(() => Promise.reject(new Error("network failed")));

    await expect(startItem(backend, item, ["+1"], false, true)).rejects.toThrow("network failed");
    expect(backend.removeReactions).not.toHaveBeenCalled();
    expect(backend.addReaction).not.toHaveBeenCalled();
  });

  it("swaps reactions without reopening an open item", async () => {
    const backend = backendWithUnresolve(() => Promise.resolve({ supported: true, applied: true }));

    await startItem(backend, item, ["confused"], false, false);
    expect(backend.unresolve).not.toHaveBeenCalled();
    expect(backend.removeReactions).toHaveBeenCalledWith(
      item,
      ["confused"],
      ["+1", "-1", "rocket", "confused"],
    );
    expect(backend.addReaction).toHaveBeenCalledWith(item, "eyes");
  });
});
