import { Command } from "@commander-js/extra-typings";
import packageJson from "../../package.json" with { type: "json" };
import { verifyPrerequisites } from "./github-environment.js";
import {
  enableRateLimitTracking,
  formatRateLimitSummary,
  getRateLimitCalls,
} from "./rate-limit-tracker.js";

/**
 * Create a Commander program with common configuration and preAction hooks.
 * Imports name, version, and description from package.json.
 *
 * Global options:
 * - --debug-rate-limit: Track and display GitHub API rate limit consumption
 *
 * Hooks:
 * - preAction: Verify gh CLI is authenticated, enable rate limit tracking
 * - postAction: Display rate limit summary if tracking was enabled
 */
export function createProgram(): Command {
  const program = new Command()
    .name(packageJson.name)
    .description(packageJson.description)
    .version(packageJson.version)
    .showHelpAfterError("(add --help for additional information)")
    .showSuggestionAfterError()
    .option(
      "--debug-rate-limit",
      "Show GitHub API rate limit usage after command",
    );

  // preAction: runs before every subcommand
  program.hook("preAction", (thisCommand) => {
    // Ensure gh CLI is installed and authenticated
    verifyPrerequisites();

    // Enable rate limit tracking if --debug-rate-limit flag is present
    const options = thisCommand.opts() as { debugRateLimit?: boolean };
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
