import { spawnSync } from "node:child_process";

/**
 * Run a git command synchronously and return its trimmed stdout.
 * Any failure causes the script to throw.
 * @param args Git command arguments. If the last argument is an object with a `cwd` property,
 *             it will be used as the working directory for the command.
 */
export function git(
  ...arguments_: [...string[], { cwd?: string }] | string[]
): string {
  let cwd: string | undefined;
  let gitArguments: string[];

  // Check if the last argument is an options object
  const lastArgument = arguments_.at(-1);
  if (
    lastArgument &&
    typeof lastArgument === "object" &&
    "cwd" in lastArgument
  ) {
    cwd = (lastArgument as { cwd?: string }).cwd;
    gitArguments = arguments_.slice(0, -1) as string[];
  } else {
    gitArguments = arguments_ as string[];
  }

  const result = spawnSync("git", gitArguments, {
    encoding: "utf8",
    maxBuffer: 100 * 1024 * 1024, // 100 MB to accommodate large outputs
    ...(cwd && { cwd }),
  });
  if (result.error) throw result.error;
  if (result.status !== 0) {
    throw new Error(
      result.stderr || `git ${gitArguments[0] ?? "command"} failed`,
    );
  }
  return result.stdout.trim();
}

/**
 * Print an error message and exit the process with status 1.
 */
export function exitWithMessage(message: string): never {
  console.error(message);
  // eslint-disable-next-line unicorn/no-process-exit
  process.exit(1);
}
