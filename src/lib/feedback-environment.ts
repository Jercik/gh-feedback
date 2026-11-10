import { git, exitWithMessage } from "./git-helpers.js";
import { detectProvider } from "./provider.js";

export function verifyPrerequisites(): string {
  try {
    git("--version");
  } catch (error) {
    return exitWithMessage(error instanceof Error ? error.message : String(error));
  }
  try {
    git("rev-parse", "--is-inside-work-tree");
  } catch {
    return exitWithMessage("Error: Not a Git repository.");
  }
  let origin: string;
  try {
    origin = git("remote", "get-url", "origin");
  } catch {
    return exitWithMessage("Error: Remote 'origin' not configured.");
  }
  const provider = detectProvider(origin);
  if (!provider) {
    return exitWithMessage(
      `Error: Unsupported git host for origin '${origin}'. Supported: code.j4k.dev, code.tail.j4k.dev.`,
    );
  }
  try {
    if (!git("config", "user.name") || !git("config", "user.email")) {
      throw new Error("Git user not configured");
    }
  } catch {
    return exitWithMessage("Error: Git user.name and user.email must be configured.");
  }
  return provider.slug;
}

export function isIgnoredAuthor(login: string): boolean {
  return login === "vercel";
}
