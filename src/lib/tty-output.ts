/**
 * Output indicators for CLI status messages.
 * Uses ASCII for maximum compatibility across terminals and pipelines.
 */

const isNoColorSet =
  process.env.NO_COLOR !== undefined && process.env.NO_COLOR !== "";
const canUseColor = process.stderr.isTTY && !isNoColorSet;

const colorize = (label: string, code: string): string =>
  canUseColor ? `\u001B[${code}m${label}\u001B[0m` : label;

/** Success indicator */
export const SUCCESS = colorize("[OK]", "32");

/** Warning indicator */
export const WARNING = colorize("[WARN]", "33");
