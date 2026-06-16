import { describe, it, expect } from "vitest";
import { detectProvider } from "./provider.js";

describe("detectProvider", () => {
  it("detects github from an https origin", () => {
    expect(detectProvider("https://github.com/Jercik/gh-feedback.git")).toEqual({
      provider: "github",
      host: "github.com",
      owner: "Jercik",
      repo: "gh-feedback",
      slug: "Jercik/gh-feedback",
    });
  });

  it("detects github from an scp-style origin", () => {
    expect(detectProvider("git@github.com:Jercik/gh-feedback.git")).toEqual({
      provider: "github",
      host: "github.com",
      owner: "Jercik",
      repo: "gh-feedback",
      slug: "Jercik/gh-feedback",
    });
  });

  it("detects forgejo from the canonical host", () => {
    expect(detectProvider("https://code.j4k.dev/j4k/cluster.git")).toEqual({
      provider: "forgejo",
      host: "code.j4k.dev",
      owner: "j4k",
      repo: "cluster",
      slug: "j4k/cluster",
    });
  });

  it("detects forgejo from the tailnet SSH origin", () => {
    expect(detectProvider("ssh://forgejo@code.tail.j4k.dev:2222/j4k/cluster.git")).toEqual({
      provider: "forgejo",
      host: "code.tail.j4k.dev",
      owner: "j4k",
      repo: "cluster",
      slug: "j4k/cluster",
    });
  });

  it("strips a trailing .git only at the end of the slug", () => {
    expect(detectProvider("https://github.com/owner/repo")).toEqual({
      provider: "github",
      host: "github.com",
      owner: "owner",
      repo: "repo",
      slug: "owner/repo",
    });
  });

  it("returns undefined for an unrecognized host", () => {
    expect(detectProvider("https://gitlab.com/owner/repo.git")).toBeUndefined();
  });
});
