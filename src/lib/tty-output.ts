/**
 * TTY-aware output helpers for consistent CLI output.
 *
 * These are constants evaluated at module load time since `process.stdout.isTTY`
 * is fixed for the process lifetime.
 */

/** Success indicator: ✅ (TTY) or [OK] (piped) */
export const SUCCESS = process.stdout.isTTY ? "\u2705" : "[OK]";

/** Warning indicator: ⚠️ (TTY) or [!] (piped) */
export const WARNING = process.stdout.isTTY ? "\u26A0\uFE0F" : "[!]";
