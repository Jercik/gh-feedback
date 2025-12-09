/**
 * TTY-aware output helpers for consistent CLI output.
 *
 * These constants are evaluated at module load time since TTY state
 * is fixed for the process lifetime. They check stderr.isTTY because
 * status messages are written to stderr (stdout is reserved for data).
 */

/** Success indicator: ✅ (TTY) or [OK] (piped) */
export const SUCCESS = process.stderr.isTTY ? "\u2705" : "[OK]";

/** Warning indicator: ⚠️ (TTY) or [!] (piped) */
export const WARNING = process.stderr.isTTY ? "\u26A0\uFE0F" : "[!]";
