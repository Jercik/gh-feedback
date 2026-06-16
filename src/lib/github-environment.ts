import { git, exitWithMessage } from "./git-helpers.js";
import { ghRaw, ghJson } from "./github-cli.js";
import { detectProvider } from "./provider.js";
import type { RepoInfo } from "./types.js";

/**
 * Verify that all prerequisites are met. The forge-specific CLI/auth check is
 * gated on the detected provider so a Forgejo repo never demands gh auth.
 * Exits with an error message if any check fails.
 */
export function verifyPrerequisites(): void {
  try {
    git("--version");
  } catch (error) {
    exitWithMessage(error instanceof Error ? error.message : String(error));
  }

  try {
    git("rev-parse", "--is-inside-work-tree");
  } catch {
    exitWithMessage("Error: Not a Git repository.");
  }

  let originUrl: string;
  try {
    originUrl = git("remote", "get-url", "origin");
  } catch {
    return exitWithMessage("Error: Remote 'origin' not configured.");
  }

  try {
    const userName = git("config", "user.name");
    const userEmail = git("config", "user.email");
    if (!userName || !userEmail) {
      throw new Error("Git user not configured");
    }
  } catch {
    exitWithMessage(
      "Error: Git user not configured. Run: git config user.name 'Your Name' && git config user.email 'you@example.com'",
    );
  }

  const info = detectProvider(originUrl);
  if (!info) {
    return exitWithMessage(
      `Error: Unsupported git host for origin '${originUrl}'. ` +
        `Supported: github.com, code.j4k.dev, code.tail.j4k.dev.`,
    );
  }

  // Forgejo auth is verified lazily when the first token is minted; only the
  // GitHub path needs an upfront gh CLI + auth check.
  if (info.provider !== "github") {
    return;
  }

  try {
    ghRaw("--version");
  } catch (error) {
    exitWithMessage(error instanceof Error ? error.message : String(error));
  }

  try {
    ghRaw("auth", "status", "-h", "github.com");
  } catch {
    exitWithMessage("Error: GitHub CLI not authenticated. Run: gh auth login");
  }
}

/**
 * Get repository owner/name information from the current directory.
 */
export function getRepositoryInfo(): RepoInfo {
  const result = ghJson<{ nameWithOwner: string }>("repo", "view", "--json", "nameWithOwner");
  const [owner, repo] = result.nameWithOwner.split("/");
  if (!owner || !repo) {
    throw new Error(`Invalid repository format: ${result.nameWithOwner}`);
  }
  return { owner, repo, ownerRepo: result.nameWithOwner };
}

/**
 * Get the PR number for the given identifier (PR number, branch name, or current branch).
 */
export function getPullRequestNumber(identifier?: string): number {
  const target = identifier ?? "";
  try {
    const result = ghJson<{ number: number }>("pr", "view", target, "--json", "number");
    return result.number;
  } catch {
    const displayTarget = identifier ?? "current branch";
    return exitWithMessage(`Error: No pull request found for ${displayTarget}.`);
  }
}

/**
 * List of bot/system authors to ignore in comment listings.
 * Keep human authors (including maintainers) visible; filter deployment bots only.
 */
const IGNORED_AUTHORS = new Set(["vercel"]);

/**
 * Check if an author should be ignored (bots, system accounts).
 */
export function isIgnoredAuthor(login: string): boolean {
  return IGNORED_AUTHORS.has(login);
}
