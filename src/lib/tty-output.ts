/**
 * TTY-aware output helpers for consistent CLI output.
 */

/**
 * Returns emoji for TTY, text fallback otherwise.
 * Useful for success/warning indicators that should be plain text when piped.
 */
function indicator(emoji: string, fallback: string): string {
  return process.stdout.isTTY ? emoji : fallback;
}

/** Success indicator: ✅ or [OK] */
export const SUCCESS = (): string => indicator("\u2705", "[OK]");

/** Warning indicator: ⚠️ or [!] */
export const WARNING = (): string => indicator("\u26A0\uFE0F", "[!]");
