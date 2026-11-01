import { runPass } from "./feedback-sweep.js";
import { fetchApiLimit } from "./snapshot-api.js";
import { forgejoApiHost, forgejoFetch } from "./forgejo-cli.js";
import { getForgejoViewer } from "./forgejo-environment.js";
import { ForgejoPull } from "./forgejo-schemas.js";

export async function fetchFeedbackSnapshot(slug: string, pr: number) {
  const host = forgejoApiHost();
  const viewer = await getForgejoViewer();
  const limit = await fetchApiLimit(host);
  async function pass(number: number) {
    const pull = ForgejoPull.parse(
      await forgejoFetch<unknown>({ path: `repos/${slug}/pulls/${pr}` }),
    );
    if (pull.number !== pr) {
      throw new Error("Forgejo returned a different pull request");
    }
    const result = await runPass(host, slug, pr, viewer, limit, number);
    return { ...result, snapshot: { ...result.snapshot, pull } };
  }
  const first = await pass(1);
  const second = await pass(2);
  const stable = JSON.stringify(first.snapshot) === JSON.stringify(second.snapshot);
  const diagnostics = [...second.diagnostics];
  if (!stable) {
    diagnostics.push("snapshot unstable: two complete passes differ; rerun until exit 0");
  }
  return {
    schema: "pr-feedback.snapshot" as const,
    version: 1 as const,
    host,
    slug,
    pr,
    viewer,
    limit,
    stable,
    diagnostics,
    ...second.snapshot,
  };
}
