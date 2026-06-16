import { describe, it, expect } from "vitest";
import { selectForgejoPull } from "./select-forgejo-pull.js";
import { ForgejoPull } from "./forgejo-schemas.js";

function pull(input: {
  number: number;
  state: string;
  ref: string;
  headRepo?: string;
}): ForgejoPull {
  return ForgejoPull.parse({
    number: input.number,
    html_url: `https://code.j4k.dev/j4k/cluster/pulls/${input.number}`,
    state: input.state,
    title: `PR ${input.number}`,
    head: {
      ref: input.ref,
      sha: "deadbeef",
      repo: input.headRepo ? { full_name: input.headRepo } : null,
    },
  });
}

describe("selectForgejoPull", () => {
  it("disambiguates same-branch fork PRs by head repo matching origin", () => {
    const pulls = [
      pull({ number: 10, state: "open", ref: "feature/foo", headRepo: "fork-a/cluster" }),
      pull({ number: 11, state: "open", ref: "feature/foo", headRepo: "j4k/cluster" }),
    ];
    expect(selectForgejoPull(pulls, "feature/foo", "j4k/cluster")?.number).toBe(11);
  });

  it("matches head repo case-insensitively", () => {
    const pulls = [pull({ number: 5, state: "open", ref: "feature/foo", headRepo: "J4K/Cluster" })];
    expect(selectForgejoPull(pulls, "feature/foo", "j4k/cluster")?.number).toBe(5);
  });

  it("returns the sole branch match when head-repo info is absent", () => {
    const pulls = [pull({ number: 7, state: "open", ref: "feature/foo" })];
    expect(selectForgejoPull(pulls, "feature/foo", "j4k/cluster")?.number).toBe(7);
  });

  it("refuses to guess when the branch is ambiguous and no head repo matches origin", () => {
    const pulls = [
      pull({ number: 10, state: "open", ref: "feature/foo", headRepo: "fork-a/cluster" }),
      pull({ number: 11, state: "open", ref: "feature/foo", headRepo: "fork-b/cluster" }),
    ];
    expect(selectForgejoPull(pulls, "feature/foo", "j4k/cluster")).toBeUndefined();
  });

  it("ignores a closed PR that reused the branch name", () => {
    const pulls = [
      pull({ number: 9, state: "closed", ref: "feature/foo", headRepo: "j4k/cluster" }),
    ];
    expect(selectForgejoPull(pulls, "feature/foo", "j4k/cluster")).toBeUndefined();
  });
});
