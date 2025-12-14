import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  enableVerboseMode,
  resetVerboseMode,
  verboseLog,
} from "./verbose-mode.js";

describe("verbose-mode", () => {
  beforeEach(() => {
    resetVerboseMode();
    vi.restoreAllMocks();
  });

  it("should be quiet by default", () => {
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    verboseLog("test");
    expect(consoleSpy).not.toHaveBeenCalled();
  });

  it("should log when enabled", () => {
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    enableVerboseMode();
    verboseLog("test");
    expect(consoleSpy).toHaveBeenCalledWith("test");
  });

  it("should accept multiple arguments", () => {
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    enableVerboseMode();
    verboseLog("message", 123, { key: "value" });
    expect(consoleSpy).toHaveBeenCalledWith("message", 123, { key: "value" });
  });
});
