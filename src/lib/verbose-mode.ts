/**
 * Verbose mode control for CLI output.
 *
 * By default, the CLI is quiet ("no news is good news").
 * Progress messages only appear when --verbose is enabled.
 */

let enabled = false;

/**
 * Enable verbose mode.
 * Called at CLI startup when --verbose flag is present.
 */
export function enableVerboseMode(): void {
  enabled = true;
}

/**
 * Log a message to stderr only in verbose mode.
 * Use for progress messages, context info, and success confirmations.
 */
export function verboseLog(message: string): void {
  if (enabled) {
    console.error(message);
  }
}
