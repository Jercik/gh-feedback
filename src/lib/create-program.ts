import { Command } from "@commander-js/extra-typings";
import packageJson from "../../package.json" with { type: "json" };
import { verifyPrerequisites } from "./github-environment.js";
import {
  enableRateLimitTracking,
  formatRateLimitSummary,
  getRateLimitCalls,
} from "./rate-limit-tracker.js";
import { enableVerboseMode } from "./verbose-mode.js";
import { GH_PATH_ENV_VAR } from "./github-cli.js";
import { GIT_PATH_ENV_VAR } from "./git-helpers.js";

/**
 * Create a Commander program with common configuration and preAction hooks.
 * Imports name, version, and description from package.json.
 *
 * Global options:
 * - -v, --verbose: Show progress messages (quiet by default)
 * - --debug-rate-limit: Track and display GitHub API rate limit consumption
 *
 * Hooks:
 * - preAction: Verify gh CLI is authenticated, enable verbose/rate-limit modes
 * - postAction: Display rate limit summary if tracking was enabled
 */
export function createProgram(): Command {
  const program = new Command()
    .name(packageJson.name)
    .description(packageJson.description)
    .version(packageJson.version)
    .showHelpAfterError("(add --help for additional information)")
    .showSuggestionAfterError()
    .helpCommand(false)
    .option("-v, --verbose", "Show progress messages (quiet by default)")
    .option(
      "--debug-rate-limit",
      "Show GitHub API rate limit usage after command",
    );

  program.addHelpText(
    "before",
    `Requires: git, gh (GitHub CLI)\n` +
      `Override paths: ${GIT_PATH_ENV_VAR}, ${GH_PATH_ENV_VAR}\n\n`,
  );

  // preAction: runs before every subcommand
  program.hook("preAction", (thisCommand) => {
    // Ensure gh CLI is installed and authenticated
    verifyPrerequisites();

    const options = thisCommand.opts() as {
      verbose?: boolean;
      debugRateLimit?: boolean;
    };

    // Enable verbose mode if --verbose flag is present
    if (options.verbose) {
      enableVerboseMode();
    }

    // Enable rate limit tracking if --debug-rate-limit flag is present
    if (options.debugRateLimit) {
      enableRateLimitTracking();
    }
  });

  // postAction: runs after every subcommand completes
  program.hook("postAction", () => {
    // If we recorded any API calls, display the rate limit summary
    if (getRateLimitCalls().length > 0) {
      // Output to stderr so it doesn't interfere with piped stdout
      console.error(formatRateLimitSummary());
    }
  });

  return program;
}
