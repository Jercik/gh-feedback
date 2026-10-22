import { describe, it, expect } from "vitest";
import { detectProvider } from "./provider.js";

describe("detectProvider", () => {
  it("detects github from an https origin", () => {
    expect(detectProvider("https://github.com/Jercik/gh-feedback.git")).toStrictEqual({
      provider: "github",
      host: "github.com",
      owner: "Jercik",
      repo: "gh-feedback",
      slug: "Jercik/gh-feedback",
    });
  });

  it("detects github from an scp-style origin", () => {
    expect(detectProvider("git@github.com:Jercik/gh-feedback.git")).toStrictEqual({
      provider: "github",
      host: "github.com",
      owner: "Jercik",
      repo: "gh-feedback",
      slug: "Jercik/gh-feedback",
    });
  });

  it("detects forgejo from the canonical host", () => {
    expect(detectProvider("https://code.j4k.dev/j4k/cluster.git")).toStrictEqual({
      provider: "forgejo",
      host: "code.j4k.dev",
      owner: "j4k",
      repo: "cluster",
      slug: "j4k/cluster",
    });
  });

  it("detects forgejo from the tailnet SSH origin", () => {
    expect(detectProvider("ssh://forgejo@code.tail.j4k.dev:2222/j4k/cluster.git")).toStrictEqual({
      provider: "forgejo",
      host: "code.tail.j4k.dev",
      owner: "j4k",
      repo: "cluster",
      slug: "j4k/cluster",
    });
  });

  it("strips a trailing .git only at the end of the slug", () => {
    expect(detectProvider("https://github.com/owner/repo.git-tools.git")).toStrictEqual({
      provider: "github",
      host: "github.com",
      owner: "owner",
      repo: "repo.git-tools",
      slug: "owner/repo.git-tools",
    });
    expect(detectProvider("https://github.com/owner/repo")).toStrictEqual({
      provider: "github",
      host: "github.com",
      owner: "owner",
      repo: "repo",
      slug: "owner/repo",
    });
  });

  it("detects github from the SSH-over-443 host", () => {
    expect(detectProvider("ssh://git@ssh.github.com:443/Jercik/gh-feedback.git")).toStrictEqual({
      provider: "github",
      host: "github.com",
      owner: "Jercik",
      repo: "gh-feedback",
      slug: "Jercik/gh-feedback",
    });
  });

  it("returns undefined for an unrecognized host", () => {
    expect(detectProvider("https://gitlab.com/owner/repo.git")).toBeUndefined();
  });

  it.each([
    "https://codeberg.org/owner/repo.git",
    "https://git.example.com:8443/owner/repo.git",
    "git@git.example.com:owner/repo.git",
    "ssh://git@gitea.internal:2222/owner/repo.git",
  ])("returns undefined for a host that only looks like a Forgejo instance: %s", (origin) => {
    expect(detectProvider(origin)).toBeUndefined();
  });
});
