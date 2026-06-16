import { describe, it, expect } from "vitest";
import { normalizeForgejoApiHost } from "./normalize-forgejo-api-host.js";

describe("normalizeForgejoApiHost", () => {
  it("passes a bare host through unchanged", () => {
    expect(normalizeForgejoApiHost("code.j4k.dev")).toBe("code.j4k.dev");
  });

  it("strips an https scheme from a full URL", () => {
    expect(normalizeForgejoApiHost("https://code.j4k.dev")).toBe("code.j4k.dev");
  });

  it("strips a scheme and trailing path", () => {
    expect(normalizeForgejoApiHost("https://code.j4k.dev/api/v1")).toBe("code.j4k.dev");
  });

  it("keeps an explicit port on a bare host", () => {
    expect(normalizeForgejoApiHost("code.j4k.dev:3000")).toBe("code.j4k.dev:3000");
  });
});
