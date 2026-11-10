import { describe, expect, it } from "vitest";
import { buildCredentialPath, parseServiceOrigin } from "./review-service-credentials.js";

describe("buildCredentialPath", () => {
  it("places the file under repos/host/owner", () => {
    expect(buildCredentialPath("/cfg", "code.j4k.dev", "j4k/setup-atlas")).toBe(
      "/cfg/repos/code.j4k.dev/j4k/setup-atlas.json",
    );
  });

  it.each(["", "Code.j4k.dev", "a..b", "a/b", ".a", "a."])("rejects host %j", (host) => {
    expect(() => buildCredentialPath("/cfg", host, "o/r")).toThrow("Invalid Forgejo host");
  });

  it.each(["o", "o/r/x", "../r", "o/..", "./r", "o/r s"])("rejects slug %j", (slug) => {
    expect(() => buildCredentialPath("/cfg", "code.j4k.dev", slug)).toThrow(
      "Invalid repository slug",
    );
  });
});

describe("parseServiceOrigin", () => {
  it("returns the origin of an https URL", () => {
    expect(parseServiceOrigin("https://review.example.test/")).toBe("https://review.example.test");
  });

  it.each([
    "http://review.example.test",
    "https://user:pw@review.example.test",
    "https://review.example.test/v1",
    "https://review.example.test/?a=1",
    "https://review.example.test/#x",
  ])("rejects %s", (url) => {
    expect(() => parseServiceOrigin(url)).toThrow("credential-free https origin");
  });
});
