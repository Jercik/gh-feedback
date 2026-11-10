import { Option } from "@commander-js/extra-typings";
import { selectCurrentBranchPull } from "./forgejo-environment.js";
import { verifyPrerequisites } from "./feedback-environment.js";

export interface FeedbackTarget {
  slug: string;
  prNumber: number;
}

export interface TargetOptions {
  repo?: string | undefined;
  pr?: string | undefined;
}

type ParsedTarget =
  | { kind: "explicit"; slug: string; prNumber: number }
  | { kind: "checkout"; prNumber: number | undefined };

export function repoOption(): Option<"--repo <owner/repo>"> {
  return new Option("--repo <owner/repo>", "Repository slug (defaults to origin; requires --pr)");
}

export function prOption(): Option<"--pr <number>"> {
  return new Option(
    "--pr <number>",
    "Pull request number (defaults to the open PR whose head is the current branch)",
  );
}

export function parseTargetOptions(options: TargetOptions): ParsedTarget {
  if (options.repo !== undefined && !/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/u.test(options.repo)) {
    throw new Error("--repo must be owner/repo");
  }
  let prNumber: number | undefined;
  if (options.pr !== undefined) {
    if (!/^[1-9]\d*$/u.test(options.pr) || !Number.isSafeInteger(Number(options.pr))) {
      throw new Error("--pr must be a positive safe integer");
    }
    prNumber = Number(options.pr);
  }
  if (options.repo === undefined) {
    return { kind: "checkout", prNumber };
  }
  if (prNumber === undefined) {
    throw new Error(
      "--repo requires --pr: a branch's pull request is looked up only in origin's repository",
    );
  }
  return { kind: "explicit", slug: options.repo, prNumber };
}

export async function resolveFeedbackTarget(options: TargetOptions): Promise<FeedbackTarget> {
  const parsed = parseTargetOptions(options);
  if (parsed.kind === "explicit") {
    return { slug: parsed.slug, prNumber: parsed.prNumber };
  }
  const { originSlug } = verifyPrerequisites();
  return {
    slug: originSlug,
    prNumber: parsed.prNumber ?? (await findCurrentBranchPullNumber(originSlug)),
  };
}

async function findCurrentBranchPullNumber(slug: string): Promise<number> {
  const { branch, selection } = await selectCurrentBranchPull(slug);
  if (selection.kind === "one") {
    return selection.number;
  }
  if (selection.kind === "none") {
    throw new Error(
      `Error: No open pull request has branch '${branch}' as its head in ${slug}. Pass --pr <number> to select one.`,
    );
  }
  const numbers = selection.numbers.map((number) => `#${number}`).join(", ");
  throw new Error(
    `Error: ${selection.numbers.length} open pull requests have branch '${branch}' as their head in ${slug} (${numbers}). Pass --pr <number> to select one.`,
  );
}
